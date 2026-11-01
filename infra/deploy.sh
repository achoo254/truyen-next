#!/usr/bin/env bash
# Build Truyện locally and release it to the shared server (.65) as a static site, by hand (every push to main
# also deploys through .github/workflows/deploy.yml, with the same switch).
#
#   SSH_TARGET=<ssh host alias> [SSH_OPTS="-F <ssh_config>"] bash infra/deploy.sh setup     # first time; nginx change
#   SSH_TARGET=<ssh host alias> [SSH_OPTS="-F <ssh_config>"] bash infra/deploy.sh release   # (the default)
#
# setup: /var/www/truyen/releases and the nginx site (only this site's file; nginx -t before reload, the previous
#   file restored on failure). Run again after editing infra/nginx/. The only path that changes nginx.
# release: refuses a dirty working tree; gates + build here; checks free disk on the server; uploads apps/web/dist
#   to /var/www/truyen/ci-incoming/<release-id> (files unchanged since the current release are copied on the
#   server instead of sent) and infra/ to /var/www/truyen/infra; refreshes the root-owned activate command the CI
#   user runs; then switches with infra/activate-incoming.sh, the switch CI uses: releases/<release-id> (unchanged
#   files hard-linked to the current release, so story media costs disk once), `current` pointed at it atomically,
#   origin check, previous release back on failure, the five newest releases kept. Manual rollback:
#   docs/deployment-guide.md.
set -euo pipefail

: "${SSH_TARGET:?set SSH_TARGET to the ssh host alias of the server}"
read -r -a ssh_opts <<<"${SSH_OPTS:-}"
mode="${1:-release}"
remote=/var/www/truyen
host=truyen.hoandat.com
dist=apps/web/dist
# Kept free on the server's disk on top of the release itself (the box is shared with other apps).
min_free_kb=$((1024 * 1024))

cd "$(dirname "$0")/.."

ssh_run() { ssh "${ssh_opts[@]}" "$SSH_TARGET" "$@"; }

setup() {
	ssh_run "mkdir -p $remote/releases $remote/infra/nginx" </dev/null
	rsync -rlz --exclude "._*" --exclude .DS_Store -e "ssh ${ssh_opts[*]}" infra/nginx/ "$SSH_TARGET:$remote/infra/nginx/"
	ssh_run bash -s <<EOF
set -euo pipefail
conf=/etc/nginx/conf.d/$host.conf
if cmp -s $remote/infra/nginx/$host.conf \$conf; then
	echo "nginx site unchanged"
	exit 0
fi
if [ -f \$conf ]; then cp \$conf \$conf.prev; fi
cp $remote/infra/nginx/$host.conf \$conf
if ! nginx -t; then
	if [ -f \$conf.prev ]; then mv \$conf.prev \$conf; else rm -f \$conf; fi
	echo "nginx -t failed: config restored, nothing reloaded" >&2
	exit 1
fi
systemctl reload nginx
echo "nginx site installed and reloaded"
EOF
}

release() {
	# The release is named after HEAD: it must be exactly HEAD.
	if [ -n "$(git status --porcelain)" ]; then
		echo "working tree is not clean: commit or stash first (git status)" >&2
		exit 1
	fi
	pnpm lint
	pnpm typecheck
	pnpm test
	pnpm build

	local id incoming need_kb
	id="$(date -u +%Y%m%d-%H%M%S)-$(git rev-parse --short=12 HEAD)"
	incoming="$remote/ci-incoming/$id"
	need_kb=$(($(du -sk "$dist" | cut -f1) * 2 + min_free_kb))
	ssh_run bash -s <<EOF
set -euo pipefail
test -d $remote/releases || { echo "run 'infra/deploy.sh setup' first" >&2; exit 1; }
free_kb=\$(df -Pk $remote | awk 'NR == 2 { print \$4 }')
if [ "\$free_kb" -lt $need_kb ]; then
	echo "only \$((free_kb / 1024)) MB free on the server, need $((need_kb / 1024)) MB: nothing uploaded" >&2
	exit 1
fi
mkdir -p $incoming $remote/infra
EOF

	# -c compares contents (every build rewrites mtimes); --copy-dest copies on the server what the current release
	# already has instead of sending it (rsync only warns when there is none yet).
	if ! rsync -rlc --exclude "._*" --exclude .DS_Store --copy-dest="$remote/current/" \
		-e "ssh ${ssh_opts[*]}" "$dist/" "$SSH_TARGET:$incoming/"; then
		ssh_run "rm -rf $incoming" </dev/null
		echo "upload failed: $incoming removed, current release untouched" >&2
		exit 1
	fi
	rsync -rlz --exclude "._*" --exclude .DS_Store -e "ssh ${ssh_opts[*]}" \
		infra/nginx infra/activate-incoming.sh infra/setup-deploy-user.sh "$SSH_TARGET:$remote/infra/"

	ssh_run bash -s <<EOF
set -euo pipefail
chown -R root:root $remote/infra
install -m 755 -o root -g root $remote/infra/activate-incoming.sh /usr/local/sbin/truyen-activate-incoming
/usr/local/sbin/truyen-activate-incoming $id
EOF
}

case "$mode" in
	setup) setup ;;
	release) release ;;
	*)
		echo "usage: infra/deploy.sh [setup|release]" >&2
		exit 2
		;;
esac
