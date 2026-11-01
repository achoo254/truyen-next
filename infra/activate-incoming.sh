#!/bin/bash
# Switches truyen.hoandat.com to an uploaded build. Root-owned; installed as
# /usr/local/sbin/truyen-activate-incoming by setup-deploy-user.sh (and
# refreshed by every manual deploy.sh release), and the only command the CI
# user `truyen-deploy` may run through sudo.
#   truyen-activate-incoming <release-id>          # <YYYYMMDD-HHMMSS>-<commit, 12 hex>
# The build waits in /var/www/truyen/ci-incoming/<id> (writable by the deploy
# user). It is moved out of the deploy user's reach before any check, must hold
# only plain files and directories with an index.html, then becomes
# releases/<id>: files unchanged since the current release are hard links to it
# (story media costs disk once). `current` is pointed at it with one atomic
# rename and the site is checked through the origin; on failure `current` goes
# back to the previous release, the new one is removed and the script exits 1.
# The five newest releases stay. nginx is never touched here: its config
# changes only through deploy.sh setup.
set -euo pipefail
ROOT=/var/www/truyen
HOST=truyen.hoandat.com
KEEP=5
ID="${1:?usage: truyen-activate-incoming <release-id>}"
[[ "$ID" =~ ^[0-9]{8}-[0-9]{6}-[0-9a-f]{12}$ ]] || { echo "bad release id" >&2; exit 2; }
SRC="$ROOT/ci-incoming/$ID"
STAGE="$ROOT/staging"
DIR="$ROOT/releases/$ID"

# One switch at a time (a CI deploy and a manual one may meet).
exec 9>"$ROOT/.activate.lock"
flock -w 300 9 || { echo "another release is being activated" >&2; exit 1; }

[ -d "$SRC" ] && [ ! -L "$SRC" ] || { echo "incoming release $ID missing" >&2; exit 2; }
[ ! -e "$DIR" ] || { echo "release $ID already exists" >&2; exit 2; }

# Checks run only once the tree is root-owned in a root-only directory, so the
# deploy user cannot swap a checked file for a symlink in between.
install -d -m 700 -o root -g root "$STAGE"
rm -rf "${STAGE:?}/$ID"
mv "$SRC" "$STAGE/$ID"
chown -R root:root "$STAGE/$ID"
if [ -n "$(find "$STAGE/$ID" ! -type f ! -type d -print -quit)" ] || [ ! -f "$STAGE/$ID/index.html" ]; then
	rm -rf "${STAGE:?}/$ID"
	echo "incoming release $ID has links, special files or no index.html" >&2
	exit 2
fi
printf '%s\n' "$ID" >"$STAGE/$ID/RELEASE"

cd "$ROOT"
mkdir -p releases
prev="$(readlink -f current || true)"
if [ -n "$prev" ] && [ -d "$prev" ]; then
	# -c compares contents (every build rewrites mtimes); no -t/-p, so unchanged files become hard links.
	rsync -rc --link-dest="$prev/" "$STAGE/$ID/" "$DIR/"
	rm -rf "${STAGE:?}/$ID"
else
	mv "$STAGE/$ID" "$DIR"
fi
find "$DIR" -type d -exec chmod 755 {} +
find "$DIR" -type f -exec chmod 644 {} +

ln -sfn "$DIR" current.next
mv -T current.next current

status() { curl -sk -o /dev/null -w '%{http_code}' --resolve "$HOST:443:127.0.0.1" "https://$HOST$1"; }
origin_ok() {
	local path code served=""
	for path in / /tre-em /stories/index.json; do
		code="$(status "$path")"
		if [ "$code" != 200 ]; then echo "origin https://$HOST$path -> $code" >&2; return 1; fi
	done
	served="$(curl -sk --resolve "$HOST:443:127.0.0.1" "https://$HOST/RELEASE" | tr -d '\r\n')"
	[ "$served" = "$ID" ] || { echo "origin serves release '$served', expected $ID" >&2; return 1; }
}
check() {
	# Right after a switch nginx may still answer from a stale worker; give it a moment.
	for _ in 1 2 3 4 5; do
		origin_ok 2>/dev/null && return 0
		sleep 1
	done
	origin_ok
}

if ! check; then
	if [ -n "$prev" ] && [ -d "$prev" ] && [ "$prev" != "$DIR" ]; then
		ln -sfn "$prev" current.next
		mv -T current.next current
		rm -rf "$DIR"
		echo "release $ID failed the origin check: back to $(basename "$prev")" >&2
	fi
	exit 1
fi

robots="$(curl -sk -D - -o /dev/null --resolve "$HOST:443:127.0.0.1" "https://$HOST/" | tr -d '\r' | awk -F': ' 'tolower($1) == "x-robots-tag" { print $2 }')"
ls -1dt releases/*/ | tail -n +$((KEEP + 1)) | xargs -r rm -rf
echo "$HOST now serves $ID (X-Robots-Tag: ${robots:-none, indexable})"
