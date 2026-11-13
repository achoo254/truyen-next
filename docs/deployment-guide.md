# Triển khai Truyện (`truyen.hoandat.com`)

Runbook deploy của repo này. Quy tắc chung của hệ sinh thái (tên, brand, box `.65` dùng chung):
`docs/ecosystem-architecture.md` của workspace `hoandat-app`. Repo public: không ghi IP, cổng SSH hay user máy chủ
vào đây; dùng alias SSH (`SSH_TARGET`) và placeholder như `<SERVER_65_IP>`, `<SSH_PORT>`.

**Trạng thái: đã ra mắt bản đọc chữ (01/11/2026).** Máy tìm kiếm được lập chỉ mục, `robots.txt` trỏ tới
`sitemap.xml`, trang mỗi truyện có nguyên lời truyện trong HTML. Tranh, giọng kể và nhạc chưa có (chờ PC); truyện chưa
có giọng thì nút ghi "Đọc truyện", có giọng thì tự đổi lại "Nghe truyện". Công tắc ở mục
[Chưa quảng bá và cách ra mắt](#chưa-quảng-bá-và-cách-ra-mắt).

**Đăng nhập (02/11/2026):** đọc vẫn không cần tài khoản. Đăng nhập bằng tài khoản hoandat.com mở ba tính năng: Tủ
truyện của tôi (`/tu-truyen`), đọc tiếp trên mọi máy, lịch sử đã đọc (`/lich-su`). Cài một lần trên máy chủ: mục
[Đăng nhập: cài lần đầu](#đăng-nhập-cài-lần-đầu).

## Kiến trúc chạy

| Phần | Ở đâu |
|---|---|
| Web (React + Vite, tĩnh) | `/var/www/truyen/current` → `/var/www/truyen/releases/<thời điểm>-<commit>`, nội dung là `apps/web/dist` cộng file `RELEASE` (mã bản) |
| API (Node, Express 5, một file bundle) | systemd `truyen-server`, user `truyen`, loopback **`127.0.0.1:5300`**, Node 22 ở `/opt/node22`; bundle nằm trong chính bản release ở `server/dist/server/index.mjs`, migration ở `server/drizzle/` (nginx không bao giờ phục vụ `server/`) |
| Database | Postgres đang chạy trên `.65`, database `truyen`, role `truyen`; migration chạy khi server khởi động |
| Đăng nhập | client BFF `truyen-web` trên `auth.hoandat.com`, scope `openid profile email`, redirect **`https://truyen.hoandat.com/auth/callback`**; phiên là cookie httpOnly `__Host-truyen_session` (30 ngày, 14 ngày không dùng thì hết) |
| Xoá tài khoản | chỉ ở `auth.hoandat.com/account` (ADR 0018 của `auth-next`); IdP gửi SET ký ES256 tới `POST https://truyen.hoandat.com/api/idp/account-deleted`, server kiểm bằng JWKS của IdP rồi xoá ngay dòng `users` và mọi thứ cascade theo (mục Xoá tài khoản) |
| Env của API | `/etc/truyen/production.env` (`root:root`, 600), cạnh `/etc/tuvi/production.env` của Tử Vi; do `infra/setup-sign-in.sh` ghi |
| Deploy | Mỗi push lên `main` có `ci` xanh: GitHub Actions, user hạn chế `truyen-deploy` (chỉ ghi `ci-incoming/`, một lệnh sudo); deploy tay bằng `infra/deploy.sh` |
| Truyện và media | Nằm trong bản build, dưới `/stories/` (`index.json`, `<slug>/story.json`, `<slug>/media/…`) |
| Đường vào | Cloudflare (proxied, SSL "full") → nginx `conf.d/truyen.hoandat.com.conf`, chứng chỉ origin chung `/etc/pki/nginx/server.{crt,key}`; `/api/`, `/auth/`, `/healthz` sang API |

**Cổng 5300:** các app khác trên `.65` dùng 4000, 4100, 4500 (IdP), 4600 (chat), 4840 (Clip), 4860 (Web Nhanh),
5290 (Tử Vi); 5300 chưa ai dùng. Kiểm trước khi cài: `ss -ltnp | grep 5300`.

Đọc truyện không bao giờ đi qua API: trang và truyện là file tĩnh, API hỏng thì nút Đăng nhập tự ẩn và mọi thứ khác
chạy như cũ. API chỉ giữ: tài khoản (`sub`, tên, email, ảnh từ userinfo), phiên, truyện đã lưu (`saved_stories`), và
mỗi truyện đã mở: cảnh đang đọc dở và lúc đọc (`reading_progress`, 200 truyện gần nhất mỗi tài khoản). Khách chưa đăng
nhập: trang đang đọc vẫn chỉ nằm trong `localStorage` (`truyen:progress`).

**Đọc tiếp trên mọi máy:** mỗi bản ghi là (truyện, cảnh, thời điểm); "cảnh 0" nghĩa là không có gì để đọc tiếp (chưa
qua cảnh đầu hoặc đã đọc hết) và vẫn mang thời điểm. Khi trang biết đã đăng nhập, trình duyệt gửi mọi bản ghi trong
máy lên `POST /api/reading`; server giữ bản mới hơn của từng truyện (thời điểm tương lai bị coi là bây giờ) và trả
danh sách đã gộp, trình duyệt gộp lại vào `localStorage` cũng theo luật bản mới hơn thắng. Lúc đọc, mỗi lần đổi cảnh
lưu ngay trong máy và gửi lên sau 2 giây (gộp nhiều thay đổi), đóng trang thì gửi nốt (`keepalive`).

`/`, `/tre-em`, `/nguoi-lon`, `/truyen/<slug>` nhận trang render sẵn của chính nó (`<đường dẫn>/index.html`, có tiêu
đề, mô tả và danh sách truyện trong HTML); mọi đường dẫn khác nhận `spa.html` (`try_files $uri $uri/index.html
/spa.html`; trước 30/10/2026 là `try_files $uri /index.html`). `/tu-truyen` và `/lich-su` cũng nhận `spa.html` nhưng
luôn kèm `X-Robots-Tag: noindex, nofollow` (và thẻ meta robots do app đặt). `/assets/` (tên có hash) cache một năm;
mọi file khác, kể cả `/stories/` và `/reading-scenes/`, trả `Cache-Control: no-cache`. Một file thiếu dưới `/assets/`,
`/stories/` hay `/reading-scenes/` là 404 thật, không phải trang app.

**CSP** (`set $truyen_csp`): `connect-src 'self'` đủ cho `/api/`; `img-src` thêm `https://lh3.googleusercontent.com`
và `https://avatars.githubusercontent.com` (ảnh tài khoản trên menu). Đăng nhập là một link thường tới `/auth/login`,
server chuyển sang `auth.hoandat.com`, nên `form-action` và `connect-src` không cần IdP. App iPhone lấy CSP từ chính
dòng này, bỏ Cloudflare Analytics và hai host ảnh (`apps/web/vite-native.ts`, có test).

Các file: [`infra/nginx/truyen.hoandat.com.conf`](../infra/nginx/truyen.hoandat.com.conf),
[`infra/truyen-server.service`](../infra/truyen-server.service), [`infra/deploy.sh`](../infra/deploy.sh),
[`infra/install-site.sh`](../infra/install-site.sh), [`infra/activate-incoming.sh`](../infra/activate-incoming.sh),
[`infra/setup-deploy-user.sh`](../infra/setup-deploy-user.sh), [`infra/setup-sign-in.sh`](../infra/setup-sign-in.sh),
[`.github/workflows/`](../.github/workflows/), mẫu env [`.env.example`](../.env.example).

## Biến môi trường của API

Trên server: `/etc/truyen/production.env`, do `infra/setup-sign-in.sh` ghi (không sửa tay; muốn đổi thì chạy lại script
hoặc thêm dòng khác, script giữ nguyên các dòng nó không quản lý). Không bao giờ in giá trị ra màn hình.

| Biến | Production |
|---|---|
| `NODE_ENV` | `production` (bắt buộc có `DATABASE_URL`, `AUTH_CLIENT_SECRET`, `PUBLIC_URL` https) |
| `PORT` | `5300` |
| `PUBLIC_URL` | `https://truyen.hoandat.com` (callback = `PUBLIC_URL/auth/callback`; cũng là origin duy nhất được gửi POST/PUT/DELETE) |
| `DATABASE_URL` | `postgres://truyen:<mật khẩu>@127.0.0.1:5432/truyen` |
| `AUTH_ISSUER` | `https://auth.hoandat.com` |
| `AUTH_CLIENT_ID` | `truyen-web` |
| `AUTH_CLIENT_SECRET` | secret của client `truyen-web`, cùng giá trị với `TRUYEN_WEB_CLIENT_SECRET` trong `/var/www/hoandat-auth/.env` của IdP (≥ 32 ký tự) |

## Lần đầu

1. **DNS:** bản ghi `A` `truyen.hoandat.com` **proxied**, trỏ về `<SERVER_65_IP>` như `tuvi` và `clip`. Token
   Cloudflare của zone `hoandat.com` nằm trên `.65` và chỉ dùng được từ IP của máy đó, nên gọi API ngay trên máy
   chủ; không chép token về máy dev, không in ra:

   ```sh
   ssh <alias> 'bash -s' <<'EOF'
   set -euo pipefail
   TOK=$(awk -F' *= *' '/dns_cloudflare_api_token/ { print $2 }' /etc/letsencrypt/cloudflare-localman.ini)
   cf() { printf 'Authorization: Bearer %s\nContent-Type: application/json\n' "$TOK" | curl -sS -H @- "$@"; }
   API=https://api.cloudflare.com/client/v4
   ZID=$(cf "$API/zones?name=hoandat.com" | jq -r '.result[0].id')
   cf "$API/zones/$ZID/dns_records?name=truyen.hoandat.com" | jq -r '.result[] | [.type, .name, .proxied] | @tsv'  # trống thì tạo
   IP=$(cf "$API/zones/$ZID/dns_records?type=A&name=tuvi.hoandat.com" | jq -r '.result[0].content')              # cùng đích với tuvi
   cf -X POST --data "$(jq -nc --arg ip "$IP" '{type:"A", name:"truyen.hoandat.com", content:$ip, proxied:true, ttl:1}')" \
     "$API/zones/$ZID/dns_records" | jq -r '.success'
   EOF
   ```

   Kiểm: `dig +short A truyen.hoandat.com @1.1.1.1` trả IP của Cloudflare.
2. **nginx, unit, user:** `SSH_TARGET=<alias> bash infra/deploy.sh setup` (mục dưới).
3. **Release:** mục [Release](#release).
4. **Đăng nhập:** mục kế tiếp.

## Đăng nhập: cài lần đầu

Làm một lần, theo đúng thứ tự (mỗi bước an toàn khi chạy lại):

1. **IdP:** deploy `auth-next` bản có client `truyen-web` (`src/oidc/sign-in-only-clients.ts`, biến `TRUYEN_WEB_URL`,
   `TRUYEN_WEB_CLIENT_SECRET`). Việc này thuộc repo `auth-next`; chưa có thì bước 4 báo lỗi rõ và các bước khác vẫn
   xong.
2. **Hạ tầng của Truyện**, từ một bản clone sạch của commit có tính năng này:

   ```sh
   SSH_TARGET=<alias> bash infra/deploy.sh setup
   ```

   Tải `infra/` lên `/var/www/truyen/infra` (root), cài lại lệnh kích hoạt mà CI dùng, rồi chạy
   `infra/install-site.sh` trên máy chủ: user hệ thống `truyen`, unit `truyen-server` (chưa bật vì chưa có env), site
   nginx mới (proxy `/api/`, `/auth/`, `/healthz`; chặn `/server/`; CSP mới; `nginx -t` hỏng thì trả file cũ). Lúc này
   `/api/` trả 502, web tự ẩn nút Đăng nhập; đọc truyện không đổi.
3. **Release có API:** push lên `main` (CI) hoặc `SSH_TARGET=<alias> bash infra/deploy.sh release`. Bản release từ đây
   mang theo `server/`; chưa có env thì `truyen-server` chưa chạy và lệnh kích hoạt ghi
   `API off (infra/setup-sign-in.sh not run yet)`.
4. **Database, bí mật, env, khởi động** (root trên `.65`, script đọc từ stdin, không cần file trên máy chủ):

   ```sh
   ssh <alias> 'bash -s' < infra/setup-sign-in.sh
   ```

   Script: tạo role và database `truyen` trên Postgres đang có (không tạo instance mới), thêm dòng
   `host truyen truyen 127.0.0.1/32 scram-sha-256` vào `pg_hba.conf` ngay sau dòng của Tử Vi (sao lưu file trước,
   reload cấu hình); sinh mật khẩu database và client secret bằng `openssl rand` ngay trên máy chủ; ghi
   `/etc/truyen/production.env` (600); thêm hoặc cập nhật `TRUYEN_WEB_URL=https://truyen.hoandat.com` và
   `TRUYEN_WEB_CLIENT_SECRET` vào `/var/www/hoandat-auth/.env` (bản cũ giữ ở `.env.bak-truyen-<thời điểm>`, cùng quyền);
   chạy lại `install-site.sh` (lúc này bật unit); reload IdP qua pm2 (chỉ khi env của IdP đổi hoặc IdP chưa biết
   `truyen-web`); restart `truyen-server` nếu bản đang chạy có API. Rồi kiểm: `/healthz` của IdP, IdP chuyển lỗi của
   `truyen-web` về đúng `https://truyen.hoandat.com/auth/callback`, `/healthz` của API, `/api/session` qua nginx trả
   `"signInAvailable":true`.

   Chạy lại không đổi bí mật đã có (lấy lại từ env của Truyện, không có thì từ env của IdP; hai bên lệch thì theo IdP).
   Chỉ in vài dòng trạng thái, không in bí mật; câu SQL đặt mật khẩu đi qua stdin, không ghi log Postgres. Có bước
   kiểm hỏng thì in `PROBLEM: …` và thoát mã 1 sau khi làm xong phần còn lại.

5. **Kiểm từ ngoài:**

   ```sh
   curl -fsS https://truyen.hoandat.com/healthz                       # ok
   curl -fsS https://truyen.hoandat.com/api/session                   # {"signedIn":false,"signInAvailable":true}
   curl -s -o /dev/null -w '%{redirect_url}\n' "https://auth.hoandat.com/auth?client_id=truyen-web&response_type=code&scope=openid" | cut -d'?' -f1
   # → https://truyen.hoandat.com/auth/callback
   ```

   Trên site thật: bấm Đăng nhập ở header, về đúng trang; lưu một truyện (`/tu-truyen` có nó); đọc tới cảnh 3, mở
   trình duyệt khác (hoặc cửa sổ ẩn danh), đăng nhập, trang truyện ghi "Đọc tiếp từ cảnh 3"; `/lich-su` có truyện đó.

## Xoá tài khoản

Tài khoản chỉ bị xoá ở `auth.hoandat.com/account`; app không có nút hay API xoá riêng. IdP báo bằng
`POST https://truyen.hoandat.com/api/idp/account-deleted` ([`account-deleted.ts`](../apps/server/src/auth/account-deleted.ts)),
body là SET (RFC 8417, `Content-Type: application/secevent+jwt`): header `alg` ES256, `typ` `secevent+jwt`; `iss` là
`AUTH_ISSUER`; `aud` đúng `PUBLIC_URL/api/idp/account-deleted`; `exp` chưa qua (lệch giờ 60 giây); event
`urn:hoandat:auth:event:account.deleted`; chữ ký kiểm bằng `jwks_uri` trong discovery của IdP. Hợp lệ thì xoá dòng
`users` của `sub` đó, cascade theo: phiên, Tủ truyện (`saved_stories`), trang đang đọc và lịch sử (`reading_progress`).
Không có gì dùng chung giữa các tài khoản nên không chuyển chủ.

Trả `202` khi đã xoá, khi không có tài khoản mang `sub` đó, hay khi nhận lại (IdP thử lại); `400` khi body không phải
SET; `401` khi SET sai (chữ ký, `iss`, `aud`, hết hạn, event); `503` khi đăng nhập đang tắt, không đọc được khoá của IdP
hay xoá lỗi, để IdP thử lại. Log chỉ ghi id nội bộ và kết quả, không ghi SET hay `sub`.

URL `https://truyen.hoandat.com/api/idp/account-deleted` phải có trong `ACCOUNT_DELETED_URLS` của env IdP (`auth-next`)
và phải đúng từng ký tự với `PUBLIC_URL` + `/api/idp/account-deleted`. nginx chuyển sẵn qua `location ~ ^/(api|auth)/`.

## Release

**Mỗi lần push lên `main` là tự deploy.** `.github/workflows/ci.yml` chạy `pnpm lint` (gồm `check:stories`),
`typecheck`, `test`, `build` (web + bundle API); xanh thì `.github/workflows/deploy.yml`:

1. Job `build` (không có khoá nào) build từ đúng commit đó, ghép bản release: `apps/web/dist` ở gốc,
   `apps/server/dist` và `apps/server/drizzle` dưới `server/`; mã bản `<YYYYMMDD-HHMMSS>-<12 ký tự commit>`.
2. Job `deploy` kiểm dung lượng trống trên máy chủ (bản release ×2 + 1 GB), tải lên
   `/var/www/truyen/ci-incoming/<mã bản>` bằng user hạn chế `truyen-deploy` (`rsync --copy-dest` lấy lại trên máy
   chủ những file bản đang chạy đã có, nên media của truyện không gửi lại), rồi chạy lệnh sudo duy nhất user đó có:
   `sudo -n /usr/local/sbin/truyen-activate-incoming <mã bản>` (bản cài của
   [`infra/activate-incoming.sh`](../infra/activate-incoming.sh)).
3. Lệnh kích hoạt (root): chuyển bản tải lên vào thư mục chỉ root đọc được rồi mới kiểm (chỉ file thường và thư mục,
   phải có `index.html`, `server/dist/server/index.mjs`, `server/drizzle/meta/_journal.json`; có link hay file đặc biệt
   thì loại), ghi `RELEASE`, tạo `releases/<mã bản>` (file giống bản đang chạy được hard link, nên media chỉ tốn đĩa
   một lần), trỏ `current` sang bằng một lần `mv -T`, restart `truyen-server` và đợi `/healthz` trên loopback (khi đã
   cài đăng nhập), kiểm `/`, `/tre-em`, `/stories/index.json` và `/RELEASE` qua nginx trên chính máy chủ. Hỏng thì
   `current` quay về bản trước, server restart trên bản đó (bản trước không có API thì dừng server), bản mới bị xoá.
   Giữ 5 bản gần nhất. Mỗi lúc chỉ một lần kích hoạt (khoá `flock`).
4. Smoke từ ngoài qua Cloudflare: `/`, `/tre-em`, `/stories/index.json` trả 200 và
   `https://truyen.hoandat.com/RELEASE` trả đúng mã bản.

Migration chạy khi `truyen-server` khởi động (bảng chỉ thêm, không xoá), nên bản mới tự nâng schema.

CI không đổi được nginx, unit hay script root: user `truyen-deploy` chỉ ghi được `ci-incoming/` và không có sudo nào
khác. Lệnh kích hoạt chỉ được cài lại bởi `deploy.sh setup`, `deploy.sh release` hay `setup-deploy-user.sh` (chạy bằng
root). Secret của repo `achoo254/truyen-next`: `DEPLOY_SSH_KEY` (khoá riêng ed25519 của `truyen-deploy`),
`DEPLOY_KNOWN_HOSTS` (`ssh-keyscan -p <SSH_PORT> -t ed25519,ecdsa,rsa <SERVER_65_IP>`), `DEPLOY_HOST`, `DEPLOY_PORT`.

**Deploy tay** (đổi nginx hay unit, lần đầu, hoặc khi CI hỏng):

```sh
SSH_TARGET=<alias> [SSH_OPTS="-F <ssh_config>"] bash infra/deploy.sh setup     # nginx, unit, user (install-site.sh)
SSH_TARGET=<alias> [SSH_OPTS="-F <ssh_config>"] bash infra/deploy.sh release   # bản mới
```

`release` từ chối chạy khi cây làm việc còn thay đổi chưa commit (bản release mang tên commit `HEAD`; phiên khác đang
sửa repo thì deploy từ một bản clone sạch). Sau đó chạy `pnpm lint`, `typecheck`, `test`, `build` trên máy dev; kiểm
dung lượng trống; gửi `apps/web/dist` và `server/` vào `ci-incoming/<mã bản>`, `infra/` vào `/var/www/truyen/infra`;
cài lại lệnh `/usr/local/sbin/truyen-activate-incoming` từ `infra/activate-incoming.sh`; rồi kích hoạt bằng chính lệnh
đó, giống hệt CI. nginx và unit chỉ đổi qua `setup`.

**Tạo hay đổi khoá của user CI** (root trên máy chủ, sau ít nhất một lần deploy tay để có `infra/` trên máy chủ):

```sh
ssh-keygen -t ed25519 -N '' -C truyen-deploy -f <thư mục tạm>/truyen-deploy
ssh <alias> 'bash /var/www/truyen/infra/setup-deploy-user.sh' < <thư mục tạm>/truyen-deploy.pub
gh secret set DEPLOY_SSH_KEY -R achoo254/truyen-next < <thư mục tạm>/truyen-deploy
```

`< /dev/null` thay cho khoá công khai: giữ khoá cũ, chỉ cài lại lệnh sudo. Khoá công khai được ghi kèm `restrict`
(không forward, không pty).

Kiểm sau release (từ ngoài, qua Cloudflare):

```sh
curl -s https://truyen.hoandat.com/RELEASE
curl -s https://truyen.hoandat.com/healthz
curl -sI https://truyen.hoandat.com/ | grep -iE '^(HTTP|x-robots-tag|content-security-policy)'
curl -s https://truyen.hoandat.com/robots.txt
for p in /tre-em /nguoi-lon /truyen/son-tinh-thuy-tinh /stories/index.json; do
  curl -s -o /dev/null -w "%{http_code} $p\n" "https://truyen.hoandat.com$p"
done
curl -s -o /dev/null -w "%{http_code} /server/ (phải 404)\n" https://truyen.hoandat.com/server/dist/server/index.mjs
E2E_BASE_URL=https://truyen.hoandat.com pnpm e2e   # smoke Playwright với site thật, không build, bỏ phần đăng nhập qua IdP giả
```

RSS của API (mục tiêu < 120 MB): `systemctl show truyen-server -p MemoryCurrent`.

## Rollback

Release hỏng tự quay về bản trước. Quay về tay:

```sh
ssh <alias> 'ls -1dt /var/www/truyen/releases/*/'      # chọn bản trước
ssh <alias> 'cd /var/www/truyen && ln -sfn releases/<bản trước> current.next && mv -T current.next current && systemctl restart truyen-server'
```

Không cần reload nginx. Bản trước ngày có đăng nhập không có `server/`: khi quay về bản đó, `systemctl stop
truyen-server` (web tự ẩn nút Đăng nhập). Migration chỉ thêm bảng/cột; bản cũ chạy được trên schema mới. Push tiếp
theo lên `main` sẽ deploy lại bản mới nhất; muốn giữ bản cũ thì revert commit rồi push.

**Tắt đăng nhập** mà không gỡ gì: xoá hai dòng `TRUYEN_WEB_*` trong `/var/www/hoandat-auth/.env` rồi reload IdP
(`pm2 startOrReload infra/ecosystem.config.cjs --update-env` trong `/var/www/hoandat-auth`); IdP từ chối client
`truyen-web` (người bấm Đăng nhập thấy trang lỗi của IdP), đọc truyện bình thường. Gọn hơn:
`systemctl disable --now truyen-server`, web tự ẩn nút Đăng nhập.

**Gỡ hẳn app:** `systemctl disable --now truyen-server`, xoá `/etc/systemd/system/truyen-server.service`
(`systemctl daemon-reload`), `/etc/truyen/`, `/etc/nginx/conf.d/truyen.hoandat.com.conf` (`nginx -t` rồi reload),
`/var/www/truyen`, user `truyen` và `truyen-deploy`, `/etc/sudoers.d/truyen-deploy`,
`/usr/local/sbin/truyen-activate-incoming`, bản ghi DNS `truyen`, dòng `truyen` trong `pg_hba.conf`, database và role
`truyen` (`dropdb truyen; dropuser truyen` bằng user `postgres`), hai dòng `TRUYEN_WEB_*` của IdP.

## Chưa quảng bá và cách ra mắt

Một công tắc duy nhất: `INDEXABLE` trong [`apps/web/site-indexing.ts`](../apps/web/site-indexing.ts) (đang là `true`
từ 01/11/2026). Khi là `false`, bản build có cả ba tín hiệu:

| Tín hiệu | Từ đâu |
|---|---|
| `robots.txt` với `Disallow: /` | Bản build ghi |
| `<meta name="robots" content="noindex, nofollow">` trong `index.html` | Bản build ghi |
| Header `X-Robots-Tag: noindex, nofollow` trên mọi response | nginx gửi khi bản release đang chạy có file đánh dấu `/noindex` (bản build ghi); không có file thì không gửi |

Khi là `true`, `robots.txt` cho phép mọi thứ trừ `/api/` và `/auth/` (không có gì để lập chỉ mục, và robot bấm "Đăng
nhập" chỉ tốn giới hạn lượt đăng nhập).

**Ra mắt:** đổi `INDEXABLE` thành `true`, commit, push lên `main` (CI tự deploy). Bản build mới cho phép robot, bỏ thẻ meta và
file đánh dấu, nginx thôi gửi header; không sửa gì trên máy chủ. Sau đó purge cache `robots.txt` trên Cloudflare nếu
cần ngay. Quảng bá (link từ app khác, app switcher, sitemap) là việc riêng, làm sau khi ra mắt.

## Log

`journalctl -u truyen-server`; nginx: `/var/log/nginx/truyen.hoandat.com.{access,error}.log`. Log của API chỉ ghi lỗi
và trạng thái đăng nhập, không ghi truyện nào ai đã lưu hay đọc: lỗi truy vấn chỉ ghi mã và thông báo của Postgres,
không ghi câu SQL hay tham số (`apps/server/src/log-error.ts`, có test). Phiên hết hạn bị xoá khi server khởi động,
mỗi giờ và mỗi lần đăng nhập. Mất kết nối Postgres (Postgres chung restart) không làm sập service.
