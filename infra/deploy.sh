#!/usr/bin/env bash
# Build Truyện locally and release it to the shared server (.65), by hand (every push to main also deploys through
# .github/workflows/deploy.yml, with the same switch).
#
#   SSH_TARGET=<ssh host alias> [SSH_OPTS="-F <ssh_config>"] bash infra/deploy.sh setup     # first time; nginx or unit change
#   SSH_TARGET=<ssh host alias> [SSH_OPTS="-F <ssh_config>"] bash infra/deploy.sh release   # (the default)
#
# Both upload infra/ to /var/www/truyen/infra (root-owned) and refresh the root-owned activate command the CI user
# runs (/usr/local/sbin/truyen-activate-incoming, from infra/activate-incoming.sh).
# setup: then runs infra/install-site.sh on the server: the `truyen` user, the truyen-server unit and the nginx site
#   (nginx -t before reload, the previous file restored on failure). The only path that changes nginx or the unit.
#   Sign-in itself (database, secrets, env of the API and of the IdP) is set up once by infra/setup-sign-in.sh.
# release: refuses a dirty working tree; gates + build here; checks free disk on the server; uploads the release to
#   /var/www/truyen/ci-incoming/<release-id>: apps/web/dist at its root, the API bundle (apps/server/dist) and its
#   migrations (apps/server/drizzle) under server/ (files unchanged since the current release are copied on the
#   server instead of sent); then switches with infra/activate-incoming.sh, the switch CI uses: releases/<release-id>
#   (unchanged files hard-linked to the current release, so story media costs disk once), `current` pointed at it
#   atomically, truyen-server restarted and /healthz checked, origin check, previous release back on failure, the
#   five newest releases kept. Manual rollback: docs/deployment-guide.md.
set -euo pipefail

: "${SSH_TARGET:?set SSH_TARGET to the ssh host alias of the server}"
read -r -a ssh_opts <<<"${SSH_OPTS:-}"
mode="${1:-release}"
remote=/var/www/truyen
dist=apps/web/dist
# Kept free on the server's disk on top of the release itself (the box is shared with other apps).
min_free_kb=$((1024 * 1024))

cd "$(dirname "$0")/.."

ssh_run() { ssh "${ssh_opts[@]}" "$SSH_TARGET" "$@"; }

# Upload infra/ (root-owned on the server) and refresh the root command the CI user runs, so it always matches the
# infra/activate-incoming.sh that this run uses.
sync_infra() {
	ssh_run "mkdir -p $remote/infra" </dev/null
	rsync -rlz --delete --exclude "._*" --exclude .DS_Store -e "ssh ${ssh_opts[*]}" infra/ "$SSH_TARGET:$remote/infra/"
	ssh_run "chown -R root:root $remote/infra && install -m 755 -o root -g root $remote/infra/activate-incoming.sh /usr/local/sbin/truyen-activate-incoming" </dev/null
}

setup() {
	sync_infra
	ssh_run "bash $remote/infra/install-site.sh" </dev/null
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
	# server/ of the release holds the API; the web build must not have a folder of that name.
	[ ! -e "$dist/server" ] || { echo "$dist/server exists: it would clash with the API bundle in the release" >&2; exit 1; }

	local id incoming need_kb
	id="$(date -u +%Y%m%d-%H%M%S)-$(git rev-parse --short=12 HEAD)"
	incoming="$remote/ci-incoming/$id"
	need_kb=$((($(du -sk "$dist" | cut -f1) + $(du -sk apps/server/dist apps/server/drizzle | awk '{ s += $1 } END { print s }')) * 2 + min_free_kb))
	ssh_run bash -s <<EOF
set -euo pipefail
test -d $remote/releases || { echo "run 'infra/deploy.sh setup' first" >&2; exit 1; }
free_kb=\$(df -Pk $remote | awk 'NR == 2 { print \$4 }')
if [ "\$free_kb" -lt $need_kb ]; then
	echo "only \$((free_kb / 1024)) MB free on the server, need $((need_kb / 1024)) MB: nothing uploaded" >&2
	exit 1
fi
mkdir -p $incoming/server
EOF

	# -c compares contents (every build rewrites mtimes); --copy-dest copies on the server what the current release
	# already has instead of sending it (rsync only warns when there is none yet).
	upload() {
		rsync -rlc --exclude "._*" --exclude .DS_Store --copy-dest="$remote/current/$2" -e "ssh ${ssh_opts[*]}" "$1" "$SSH_TARGET:$incoming/$2"
	}
	if ! upload "$dist/" "" || ! upload apps/server/dist "server/" || ! upload apps/server/drizzle "server/"; then
		ssh_run "rm -rf $incoming" </dev/null
		echo "upload failed: $incoming removed, current release untouched" >&2
		exit 1
	fi
	sync_infra
	ssh_run "/usr/local/sbin/truyen-activate-incoming $id" </dev/null
}

case "$mode" in
	setup) setup ;;
	release) release ;;
	*)
		echo "usage: infra/deploy.sh [setup|release]" >&2
		exit 2
		;;
esac
