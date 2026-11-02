#!/bin/bash
# Installs what Truyện needs from the system, from the root-owned copy of infra/ on the server
# (/var/www/truyen/infra, uploaded by infra/deploy.sh). Run as root on the server, by `infra/deploy.sh setup` and by
# infra/setup-sign-in.sh; safe to run again (only what changed is installed):
#   bash /var/www/truyen/infra/install-site.sh
# - the system user `truyen` the API runs as, and /var/www/truyen/releases;
# - the unit /etc/systemd/system/truyen-server.service (a changed unit restarts a running service), enabled once its
#   env file /etc/truyen/production.env exists (infra/setup-sign-in.sh writes it);
# - this site's nginx file /etc/nginx/conf.d/truyen.hoandat.com.conf: `nginx -t` before the reload, the previous
#   file put back when it fails. Only this site's file is touched.
set -euo pipefail
ROOT=/var/www/truyen
HOST=truyen.hoandat.com
UNIT=/etc/systemd/system/truyen-server.service
ENV_FILE=/etc/truyen/production.env
CONF="/etc/nginx/conf.d/$HOST.conf"
[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }
for f in truyen-server.service "nginx/$HOST.conf"; do
	[ -f "$ROOT/infra/$f" ] || { echo "missing $ROOT/infra/$f: run infra/deploy.sh setup from the repo first" >&2; exit 1; }
done

if ! id truyen >/dev/null 2>&1; then
	useradd --system --no-create-home --shell /sbin/nologin truyen
	echo "user truyen created"
fi
mkdir -p "$ROOT/releases"

if ! cmp -s "$ROOT/infra/truyen-server.service" "$UNIT"; then
	install -m 644 "$ROOT/infra/truyen-server.service" "$UNIT"
	systemctl daemon-reload
	# A running service keeps the old unit until restarted (no-op when it is not running).
	systemctl try-restart truyen-server
	echo "truyen-server unit installed"
fi
if [ -f "$ENV_FILE" ] && ! systemctl is-enabled --quiet truyen-server; then
	systemctl enable truyen-server >/dev/null 2>&1
	echo "truyen-server enabled"
fi

if cmp -s "$ROOT/infra/nginx/$HOST.conf" "$CONF"; then
	echo "nginx site unchanged"
	exit 0
fi
if [ -f "$CONF" ]; then cp "$CONF" "$CONF.prev"; fi
cp "$ROOT/infra/nginx/$HOST.conf" "$CONF"
if ! check="$(nginx -t 2>&1)"; then
	if [ -f "$CONF.prev" ]; then mv "$CONF.prev" "$CONF"; else rm -f "$CONF"; fi
	printf '%s\n' "$check" >&2
	echo "nginx -t failed: previous site file restored, nothing reloaded" >&2
	exit 1
fi
systemctl reload nginx
echo "nginx site installed and reloaded"
