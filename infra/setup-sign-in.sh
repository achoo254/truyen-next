#!/bin/bash
# One-time setup of sign-in for truyen.hoandat.com on the shared server (.65). Run as root, the script on stdin:
#   ssh <alias> 'bash -s' < infra/setup-sign-in.sh
# Needs first: `infra/deploy.sh setup` (puts infra/ in /var/www/truyen/infra), and auth-next deployed with the
# client truyen-web (TRUYEN_WEB_URL + TRUYEN_WEB_CLIENT_SECRET, src/oidc/sign-in-only-clients.ts).
#
# 1. Postgres (the instance already on the box, no new one): role and database `truyen`, a pg_hba line for it on
#    127.0.0.1 next to the other products' lines (the file backed up first), configuration reloaded.
# 2. Secrets made here with `openssl rand`, never printed: the database password and the client secret.
# 3. /etc/truyen/production.env (root:root, 600), the env of truyen-server, beside Tử Vi's /etc/tuvi/production.env.
# 4. The IdP's env /var/www/hoandat-auth/.env: TRUYEN_WEB_URL and TRUYEN_WEB_CLIENT_SECRET set or updated, after a
#    copy of the file (.env.bak-truyen-<time>, same mode).
# 5. infra/install-site.sh: the `truyen` user, the truyen-server unit, the nginx site (nginx -t, old file restored).
# 6. Restarts: the IdP (pm2, only when its env changed or it does not know truyen-web yet) and truyen-server (once a
#    release carries the API bundle), then checks both.
#
# Idempotent: a second run keeps the secrets already in place (in Truyện's env, else the IdP's) and changes nothing
# that is already right. Prints a few status lines only, never a secret. Exits 1 when a check fails.
set -euo pipefail
umask 077

# The whole script is one function, called on the last line: bash reads it in full before running anything, so no
# command below can swallow the rest of the script from stdin (`bash -s`).
main() {
cd /
HOST=truyen.hoandat.com
PUBLIC_URL="https://$HOST"
PORT=5300
CLIENT_ID=truyen-web
ISSUER=https://auth.hoandat.com
DB=truyen
DB_USER=truyen
PG_ADDR=127.0.0.1
PG_PORT=5432
ROOT=/var/www/truyen
ENV_FILE=/etc/truyen/production.env
AUTH_DIR=/var/www/hoandat-auth
AUTH_ENV="$AUTH_DIR/.env"
AUTH_PORT=4500

say() { printf 'setup-sign-in: %s\n' "$*"; }
die() {
	printf 'setup-sign-in: %s\n' "$*" >&2
	exit 1
}
problems=0
problem() {
	printf 'setup-sign-in: PROBLEM: %s\n' "$*" >&2
	problems=$((problems + 1))
}

[ "$(id -u)" -eq 0 ] || die "run as root"
[ -f "$ROOT/infra/install-site.sh" ] || die "no $ROOT/infra/install-site.sh: run 'infra/deploy.sh setup' from the repo first"
[ -f "$AUTH_ENV" ] || die "no $AUTH_ENV (auth-next not installed here?)"
for tool in openssl psql runuser curl nginx systemctl; do
	command -v "$tool" >/dev/null 2>&1 || die "missing command: $tool"
done

# The value of KEY in an env file (first line, surrounding quotes dropped), or nothing. Never printed.
env_value() {
	[ -f "$1" ] || return 0
	sed -n "s/^$2=//p" "$1" | head -n 1 | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/"
}

# Sets KEY=VALUE lines in an env file: other lines kept, these keys replaced (written at the end, in this order), the
# file's owner and mode kept (a new file: root:root 600). With BACKUP=1 the old file is copied first. Returns 0 when
# the file changed, 1 when it already said exactly this. Values only go through shell builtins (no process argv).
set_env() {
	local file=$1 tmp kv pattern=""
	shift
	for kv in "$@"; do pattern="$pattern${pattern:+|}${kv%%=*}"; done
	tmp="$(mktemp "$(dirname "$file")/.$(basename "$file").XXXXXX")"
	if [ -f "$file" ]; then grep -v -E "^($pattern)=" "$file" >"$tmp" || true; fi
	printf '%s\n' "$@" >>"$tmp"
	if [ -f "$file" ] && cmp -s "$tmp" "$file"; then
		rm -f "$tmp"
		return 1
	fi
	if [ -f "$file" ]; then
		chown --reference="$file" "$tmp"
		chmod --reference="$file" "$tmp"
		if [ "${BACKUP:-0}" = 1 ]; then cp -p "$file" "$file.bak-truyen-$(date +%Y%m%d-%H%M%S)"; fi
	else
		chown root:root "$tmp"
		chmod 600 "$tmp"
	fi
	mv -f "$tmp" "$file"
	return 0
}

pg() { runuser -u postgres -- psql -X -q -v ON_ERROR_STOP=1 "$@"; }

# --- secrets: kept when already set ---------------------------------------------------------------------------
db_password="$(env_value "$ENV_FILE" DATABASE_URL | sed -n "s#^postgres://$DB_USER:\([^@]*\)@.*#\1#p")"
if [ -z "$db_password" ]; then
	db_password="$(openssl rand -hex 24)"
	say "database password: new"
else
	say "database password: kept"
fi
[[ "$db_password" =~ ^[A-Za-z0-9]+$ ]] || die "the database password in $ENV_FILE is not alphanumeric; fix the file by hand"

idp_secret="$(env_value "$AUTH_ENV" TRUYEN_WEB_CLIENT_SECRET)"
app_secret="$(env_value "$ENV_FILE" AUTH_CLIENT_SECRET)"
if [ -n "$idp_secret" ]; then
	# The IdP decides which secret the client has.
	client_secret="$idp_secret"
	if [ -n "$app_secret" ] && [ "$app_secret" != "$idp_secret" ]; then say "client secret: the IdP's and Truyện's differed, using the IdP's"; else say "client secret: kept"; fi
elif [ -n "$app_secret" ]; then
	client_secret="$app_secret"
	say "client secret: kept (from Truyện's env)"
else
	client_secret="$(openssl rand -hex 32)"
	say "client secret: new"
fi
[ "${#client_secret}" -ge 32 ] || die "the client secret in place is shorter than 32 characters; remove it and run again"

# --- 1. Postgres -------------------------------------------------------------------------------------------------
pg -tAc 'select 1' >/dev/null || die "cannot reach Postgres as the postgres user"
can_login() { PGPASSWORD="$db_password" psql -X -w -h "$PG_ADDR" -p "$PG_PORT" -U "$DB_USER" -d "$DB" -tAc 'select 1' >/dev/null 2>&1; }

if [ "$(pg -tAc "select 1 from pg_roles where rolname = '$DB_USER'")" = 1 ]; then role_sql="ALTER ROLE $DB_USER WITH LOGIN PASSWORD :'pw'"; else role_sql="CREATE ROLE $DB_USER LOGIN PASSWORD :'pw'"; fi
if [ "$(pg -tAc "select 1 from pg_database where datname = '$DB'")" = 1 ] && can_login; then
	say "postgres: role and database $DB ready"
else
	# On stdin, not in argv; this session logs no statement, so the password never reaches the server log.
	if ! pg >/dev/null 2>&1 <<SQL; then
SET log_statement = 'none';
SET log_min_duration_statement = -1;
SET log_min_error_statement = panic;
\\set pw '$db_password'
$role_sql;
SQL
		die "postgres: could not set the role $DB_USER (details withheld: the statement holds the password)"
	fi
	if [ "$(pg -tAc "select 1 from pg_database where datname = '$DB'")" != 1 ]; then
		runuser -u postgres -- createdb -O "$DB_USER" "$DB"
		say "postgres: database $DB created"
	fi
	say "postgres: role $DB_USER ready"
fi

hba="$(pg -tAc 'show hba_file')"
[ -f "$hba" ] || die "postgres: pg_hba file not found"
if grep -q -E "^[[:space:]]*host[[:space:]]+${DB}[[:space:]]+${DB_USER}[[:space:]]+${PG_ADDR}/32[[:space:]]" "$hba"; then
	say "postgres: pg_hba line present"
else
	cp -p "$hba" "$hba.bak-truyen-$(date +%Y%m%d-%H%M%S)"
	line="host    $DB    $DB_USER    $PG_ADDR/32    scram-sha-256"
	tmp="$(mktemp "$hba.XXXXXX")"
	# Right after Tử Vi's line when there is one, else before the first host rule (the first matching rule wins).
	awk -v line="$line" '
		{ lines[NR] = $0 }
		/^[[:space:]]*host[[:space:]]+tuvi[[:space:]]+tuvi[[:space:]]/ { tuvi = NR }
		/^[[:space:]]*host[[:space:]]/ && !first { first = NR }
		END {
			for (i = 1; i <= NR; i++) {
				if (!tuvi && i == first) print line
				print lines[i]
				if (tuvi && i == tuvi) print line
			}
			if (!tuvi && !first) print line
		}' "$hba" >"$tmp"
	# Written in place: the file keeps its owner, mode and SELinux label.
	cat "$tmp" >"$hba"
	rm -f "$tmp"
	pg -tAc 'select pg_reload_conf()' >/dev/null
	say "postgres: pg_hba line added, configuration reloaded"
fi
sleep 1
can_login || die "postgres: $DB_USER cannot log in to $DB on $PG_ADDR:$PG_PORT (check pg_hba order)"

# --- 3. Truyện's env -----------------------------------------------------------------------------------------------
install -d -m 755 -o root -g root /etc/truyen
if set_env "$ENV_FILE" \
	"NODE_ENV=production" \
	"PORT=$PORT" \
	"PUBLIC_URL=$PUBLIC_URL" \
	"DATABASE_URL=postgres://$DB_USER:$db_password@$PG_ADDR:$PG_PORT/$DB" \
	"AUTH_ISSUER=$ISSUER" \
	"AUTH_CLIENT_ID=$CLIENT_ID" \
	"AUTH_CLIENT_SECRET=$client_secret"; then
	app_env_changed=1
	say "truyen env: written ($ENV_FILE, 600)"
else
	app_env_changed=0
	say "truyen env: unchanged"
fi
chown root:root "$ENV_FILE"
chmod 600 "$ENV_FILE"

# --- 4. the IdP's env ----------------------------------------------------------------------------------------------
if BACKUP=1 set_env "$AUTH_ENV" "TRUYEN_WEB_URL=$PUBLIC_URL" "TRUYEN_WEB_CLIENT_SECRET=$client_secret"; then
	auth_env_changed=1
	say "auth env: TRUYEN_WEB_* set (previous file kept as $AUTH_ENV.bak-truyen-*)"
else
	auth_env_changed=0
	say "auth env: unchanged"
fi

# --- 5. user, unit, nginx ------------------------------------------------------------------------------------------
bash "$ROOT/infra/install-site.sh" | sed 's/^/setup-sign-in: /'

# --- 6. restarts and checks ----------------------------------------------------------------------------------------
idp_knows_client() {
	local to
	to="$(curl -sk -o /dev/null -w '%{redirect_url}' --resolve "auth.hoandat.com:443:127.0.0.1" \
		"$ISSUER/auth?client_id=$CLIENT_ID&response_type=code&scope=openid")"
	case "$to" in "$PUBLIC_URL/auth/callback"*) return 0 ;; *) return 1 ;; esac
}
wait_for() {
	for _ in $(seq 1 30); do
		curl -fsS "$1" >/dev/null 2>&1 && return 0
		sleep 1
	done
	return 1
}

if [ "$auth_env_changed" = 1 ] || ! idp_knows_client; then
	# pm2 runs as root with nvm's Node (auth-next/infra/deploy.sh); --update-env re-reads .env.
	if (
		set +u
		# shellcheck disable=SC1091
		source /root/.nvm/nvm.sh >/dev/null &&
			cd "$AUTH_DIR" &&
			pm2 startOrReload infra/ecosystem.config.cjs --update-env >/dev/null &&
			pm2 save >/dev/null
	); then
		say "auth: reloaded"
	else
		problem "auth: pm2 reload failed (pm2 logs hoandat-auth)"
	fi
fi
if wait_for "http://127.0.0.1:$AUTH_PORT/healthz"; then say "auth: healthz ok"; else problem "auth: /healthz not answering (pm2 logs hoandat-auth)"; fi
if idp_knows_client; then
	say "auth: client $CLIENT_ID registered, redirect $PUBLIC_URL/auth/callback"
else
	problem "auth: the IdP does not know $CLIENT_ID (deploy auth-next with the truyen-web client, then run this again)"
fi

[ -x /opt/node22/bin/node ] || problem "no /opt/node22/bin/node (the unit's Node)"
if [ -f "$ROOT/current/server/dist/server/index.mjs" ]; then
	if [ "$app_env_changed" = 1 ] || ! systemctl is-active --quiet truyen-server; then
		if systemctl restart truyen-server; then say "truyen-server: restarted"; else problem "truyen-server: restart failed"; fi
	fi
	if wait_for "http://127.0.0.1:$PORT/healthz"; then
		say "truyen-server: healthz ok"
		if curl -sk --resolve "$HOST:443:127.0.0.1" "$PUBLIC_URL/api/session" | grep -q '"signInAvailable":true'; then
			say "site: /api/session says sign-in is available"
		else
			problem "site: /api/session does not offer sign-in through nginx"
		fi
	else
		problem "truyen-server: /healthz not answering (journalctl -u truyen-server -n 40)"
	fi
else
	say "truyen-server: waiting for a release with the API bundle (push to main, or infra/deploy.sh release); it starts with that release"
fi

if [ "$problems" -gt 0 ]; then
	say "done with $problems problem(s)"
	exit 1
fi
say "done"
}

main "$@" </dev/null
