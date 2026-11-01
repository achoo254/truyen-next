# Triển khai Truyện (`truyen.hoandat.com`)

Runbook deploy của repo này. Quy tắc chung của hệ sinh thái (tên, brand, box `.65` dùng chung):
`docs/ecosystem-architecture.md` của workspace `hoandat-app`. Repo public: không ghi IP, cổng SSH hay user máy chủ
vào đây; dùng alias SSH (`SSH_TARGET`) và placeholder như `<SERVER_65_IP>`, `<SSH_PORT>`.

**Trạng thái: đã ra mắt bản đọc chữ (01/11/2026).** Máy tìm kiếm được lập chỉ mục, `robots.txt` trỏ tới
`sitemap.xml`, trang mỗi truyện có nguyên lời truyện trong HTML. Tranh, giọng kể và nhạc chưa có (chờ PC); truyện chưa
có giọng thì nút ghi "Đọc truyện", có giọng thì tự đổi lại "Nghe truyện". Công tắc ở mục
[Chưa quảng bá và cách ra mắt](#chưa-quảng-bá-và-cách-ra-mắt).

## Kiến trúc chạy

| Phần | Ở đâu |
|---|---|
| Web (React + Vite, tĩnh) | `/var/www/truyen/current` → `/var/www/truyen/releases/<thời điểm>-<commit>`, nội dung là `apps/web/dist` cộng file `RELEASE` (mã bản) |
| Deploy | Mỗi push lên `main` có `ci` xanh: GitHub Actions, user hạn chế `truyen-deploy` (chỉ ghi `ci-incoming/`, một lệnh sudo); deploy tay bằng `infra/deploy.sh` |
| Truyện và media | Nằm trong bản build, dưới `/stories/` (`index.json`, `<slug>/story.json`, `<slug>/media/…`) |
| Đường vào | Cloudflare (proxied, SSL "full") → nginx `conf.d/truyen.hoandat.com.conf`, chứng chỉ origin chung `/etc/pki/nginx/server.{crt,key}` |
| Tiến trình | Không có: không API, không systemd unit, không database, không đăng nhập |

`/`, `/tre-em`, `/nguoi-lon`, `/truyen/<slug>` nhận trang render sẵn của chính nó (`<đường dẫn>/index.html`, có tiêu
đề, mô tả và danh sách truyện trong HTML); mọi đường dẫn khác nhận `spa.html` (`try_files $uri $uri/index.html
/spa.html`; trước 30/10/2026 là `try_files $uri /index.html`). `/assets/` (tên có hash) cache một năm; mọi file khác,
kể cả `/stories/` và `/reading-scenes/`, trả `Cache-Control: no-cache`. Một file thiếu dưới `/assets/`, `/stories/`
hay `/reading-scenes/` là 404 thật, không phải trang app.

Các file: [`infra/nginx/truyen.hoandat.com.conf`](../infra/nginx/truyen.hoandat.com.conf),
[`infra/deploy.sh`](../infra/deploy.sh), [`infra/activate-incoming.sh`](../infra/activate-incoming.sh),
[`infra/setup-deploy-user.sh`](../infra/setup-deploy-user.sh), [`.github/workflows/`](../.github/workflows/).

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
2. **nginx:** `SSH_TARGET=<alias> bash infra/deploy.sh setup`. Chỉ thêm/ghi đè file của site này trong
   `/etc/nginx/conf.d/`; `nginx -t` hỏng thì trả lại file cũ và không reload.
3. **Release:** mục dưới.

## Release

**Mỗi lần push lên `main` là tự deploy.** `.github/workflows/ci.yml` chạy `pnpm lint` (gồm `check:stories`),
`typecheck`, `test`, `build`; xanh thì `.github/workflows/deploy.yml`:

1. Job `build` (không có khoá nào) build `apps/web/dist` từ đúng commit đó và đặt mã bản
   `<YYYYMMDD-HHMMSS>-<12 ký tự commit>`.
2. Job `deploy` kiểm dung lượng trống trên máy chủ (bản build ×2 + 1 GB), tải bản build lên
   `/var/www/truyen/ci-incoming/<mã bản>` bằng user hạn chế `truyen-deploy` (`rsync --copy-dest` lấy lại trên máy
   chủ những file bản đang chạy đã có, nên media của truyện không gửi lại), rồi chạy lệnh sudo duy nhất user đó có:
   `sudo -n /usr/local/sbin/truyen-activate-incoming <mã bản>` (bản cài của
   [`infra/activate-incoming.sh`](../infra/activate-incoming.sh)).
3. Lệnh kích hoạt (root): chuyển bản tải lên vào thư mục chỉ root đọc được rồi mới kiểm (chỉ file thường và thư mục,
   phải có `index.html`; có link hay file đặc biệt thì loại), ghi `RELEASE`, tạo `releases/<mã bản>` (file giống bản
   đang chạy được hard link, nên media chỉ tốn đĩa một lần), trỏ `current` sang bằng một lần `mv -T`, kiểm `/`,
   `/tre-em`, `/stories/index.json` và `/RELEASE` qua nginx trên chính máy chủ. Hỏng thì `current` quay về bản trước
   và bản mới bị xoá. Giữ 5 bản gần nhất. Mỗi lúc chỉ một lần kích hoạt (khoá `flock`).
4. Smoke từ ngoài qua Cloudflare: `/`, `/tre-em`, `/stories/index.json` trả 200 và
   `https://truyen.hoandat.com/RELEASE` trả đúng mã bản.

CI không đổi được nginx hay script root: user `truyen-deploy` chỉ ghi được `ci-incoming/` và không có sudo nào khác.
Secret của repo `achoo254/truyen-next`: `DEPLOY_SSH_KEY` (khoá riêng ed25519 của `truyen-deploy`),
`DEPLOY_KNOWN_HOSTS` (`ssh-keyscan -p <SSH_PORT> -t ed25519,ecdsa,rsa <SERVER_65_IP>`), `DEPLOY_HOST`, `DEPLOY_PORT`.

**Deploy tay** (đổi nginx, lần đầu, hoặc khi CI hỏng):

```sh
SSH_TARGET=<alias> [SSH_OPTS="-F <ssh_config>"] bash infra/deploy.sh release
```

Script từ chối chạy khi cây làm việc còn thay đổi chưa commit (bản release mang tên commit `HEAD`; phiên khác đang sửa
repo thì deploy từ một bản clone sạch). Sau đó chạy `pnpm lint`, `typecheck`, `test`, `build` trên máy dev; kiểm dung
lượng trống; gửi `apps/web/dist` vào `ci-incoming/<mã bản>` và `infra/` vào `/var/www/truyen/infra`; cài lại lệnh
`/usr/local/sbin/truyen-activate-incoming` từ `infra/activate-incoming.sh`; rồi kích hoạt bằng chính lệnh đó, giống
hệt CI. nginx chỉ đổi qua `infra/deploy.sh setup`.

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
curl -sI https://truyen.hoandat.com/ | grep -iE '^(HTTP|x-robots-tag|content-security-policy)'
curl -s https://truyen.hoandat.com/robots.txt
for p in /tre-em /nguoi-lon /truyen/son-tinh-thuy-tinh /stories/index.json; do
  curl -s -o /dev/null -w "%{http_code} $p\n" "https://truyen.hoandat.com$p"
done
E2E_BASE_URL=https://truyen.hoandat.com pnpm e2e   # smoke Playwright với site thật, không build
```

## Rollback

Release hỏng tự quay về bản trước. Quay về tay:

```sh
ssh <alias> 'ls -1dt /var/www/truyen/releases/*/'      # chọn bản trước
ssh <alias> 'cd /var/www/truyen && ln -sfn releases/<bản trước> current.next && mv -T current.next current'
```

Không cần reload nginx. Push tiếp theo lên `main` sẽ deploy lại bản mới nhất; muốn giữ bản cũ thì revert commit rồi
push. Gỡ hẳn app: xoá `/etc/nginx/conf.d/truyen.hoandat.com.conf` (`nginx -t` rồi reload), xoá `/var/www/truyen`,
user `truyen-deploy`, `/etc/sudoers.d/truyen-deploy`, `/usr/local/sbin/truyen-activate-incoming`, bản ghi DNS `truyen`.

## Chưa quảng bá và cách ra mắt

Một công tắc duy nhất: `INDEXABLE` trong [`apps/web/site-indexing.ts`](../apps/web/site-indexing.ts) (đang là `true`
từ 01/11/2026). Khi là `false`, bản build có cả ba tín hiệu:

| Tín hiệu | Từ đâu |
|---|---|
| `robots.txt` với `Disallow: /` | Bản build ghi |
| `<meta name="robots" content="noindex, nofollow">` trong `index.html` | Bản build ghi |
| Header `X-Robots-Tag: noindex, nofollow` trên mọi response | nginx gửi khi bản release đang chạy có file đánh dấu `/noindex` (bản build ghi); không có file thì không gửi |

**Ra mắt:** đổi `INDEXABLE` thành `true`, commit, push lên `main` (CI tự deploy). Bản build mới cho phép robot, bỏ thẻ meta và
file đánh dấu, nginx thôi gửi header; không sửa gì trên máy chủ. Sau đó purge cache `robots.txt` trên Cloudflare nếu
cần ngay. Quảng bá (link từ app khác, app switcher, sitemap) là việc riêng, làm sau khi ra mắt.

## Log

nginx: `/var/log/nginx/truyen.hoandat.com.{access,error}.log`.
