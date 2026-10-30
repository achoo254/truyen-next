#!/usr/bin/env bash
# Build Truyện locally and release it to the shared server (.65) as a static site.
#
#   SSH_TARGET=<ssh host alias> [SSH_OPTS="-F <ssh_config>"] bash infra/deploy.sh setup     # first time; nginx change
#   SSH_TARGET=<ssh host alias> [SSH_OPTS="-F <ssh_config>"] bash infra/deploy.sh release   # (the default)
#
# setup: /var/www/truyen/releases and the nginx site (only this site's file; nginx -t before reload, the previous
#   file restored on failure). Run again after editing infra/nginx/.
# release: refuses a dirty working tree; gates + build here; checks free disk on the server; uploads apps/web/dist
#   to /var/www/truyen/releases/<stamp>-<commit> (files unchanged since the current release are hard links to it,
#   so story media costs disk once); points `current` at it atomically; checks the site through nginx on the
#   server. On failure `current` goes back to the previous release and the script exits 1. The five newest
#   releases stay. Manual rollback: docs/deployment-guide.md.
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

	local stamp dir need_kb
	stamp="$(date -u +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD)"
	dir="$remote/releases/$stamp"
	need_kb=$(($(du -sk "$dist" | cut -f1) + min_free_kb))
	ssh_run bash -s <<EOF
set -euo pipefail
test -d $remote/releases || { echo "run 'infra/deploy.sh setup' first" >&2; exit 1; }
free_kb=\$(df -Pk $remote | awk 'NR == 2 { print \$4 }')
if [ "\$free_kb" -lt $need_kb ]; then
	echo "only \$((free_kb / 1024)) MB free on the server, need $((need_kb / 1024)) MB: nothing uploaded" >&2
	exit 1
fi
mkdir -p $dir
EOF

	# -c compares contents (every build rewrites mtimes); --link-dest hard-links what the current release already
	# has (rsync only warns when there is none yet, on the first release). No -p/--chmod: the macOS rsync
	# (openrsync) lacks the D/F modes, so the modes are set on the server below.
	if ! rsync -rlc --exclude "._*" --exclude .DS_Store --link-dest="$remote/current/" \
		-e "ssh ${ssh_opts[*]}" "$dist/" "$SSH_TARGET:$dir/"; then
		ssh_run "rm -rf $dir" </dev/null
		echo "upload failed: $dir removed, current release untouched" >&2
		exit 1
	fi

	ssh_run bash -s <<EOF
set -euo pipefail
cd $remote
find $dir -type d -exec chmod 755 {} +
find $dir -type f -exec chmod 644 {} +
prev=\$(readlink -f current || true)
ln -sfn $dir current.next
mv -T current.next current
status() { curl -sk -o /dev/null -w '%{http_code}' --resolve $host:443:127.0.0.1 "https://$host\$1"; }
origin_ok() {
	local path code
	for path in / /tre-em /stories/index.json; do
		code=\$(status "\$path")
		if [ "\$code" != 200 ]; then echo "origin https://$host\$path -> \$code" >&2; return 1; fi
	done
}
if ! origin_ok; then
	if [ -n "\$prev" ] && [ -d "\$prev" ] && [ "\$prev" != "$dir" ]; then
		echo "release failed: switching back to \$prev" >&2
		ln -sfn "\$prev" current.next
		mv -T current.next current
	fi
	exit 1
fi
robots=\$(curl -sk -D - -o /dev/null --resolve $host:443:127.0.0.1 https://$host/ | tr -d '\r' | awk -F': ' 'tolower(\$1) == "x-robots-tag" { print \$2 }')
echo "origin 200 for /, /tre-em, /stories/index.json; release \$(basename "\$(readlink -f current)"); X-Robots-Tag: \${robots:-none (indexable)}"
ls -1dt releases/*/ | tail -n +6 | xargs -r rm -rf
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
