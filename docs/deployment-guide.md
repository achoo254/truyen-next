# Triển khai Truyện (`truyen.hoandat.com`)

Runbook deploy của repo này. Quy tắc chung của hệ sinh thái (tên, brand, box `.65` dùng chung):
`docs/ecosystem-architecture.md` của workspace `hoandat-app`. Repo public: không ghi IP, cổng SSH hay user máy chủ
vào đây; dùng alias SSH (`SSH_TARGET`) và placeholder như `<SERVER_65_IP>`, `<SSH_PORT>`.

**Trạng thái: đang chạy nhưng chưa quảng bá.** Site mở được nhưng báo máy tìm kiếm không lập chỉ mục (mục
[Chưa quảng bá](#chưa-quảng-bá-và-cách-ra-mắt)); không app nào trỏ link tới đây, chưa gửi sitemap.

## Kiến trúc chạy

| Phần | Ở đâu |
|---|---|
| Web (React + Vite, tĩnh) | `/var/www/truyen/current` → `/var/www/truyen/releases/<thời điểm>-<commit>`, nội dung là `apps/web/dist` |
| Truyện và media | Nằm trong bản build, dưới `/stories/` (`index.json`, `<slug>/story.json`, `<slug>/media/…`) |
| Đường vào | Cloudflare (proxied, SSL "full") → nginx `conf.d/truyen.hoandat.com.conf`, chứng chỉ origin chung `/etc/pki/nginx/server.{crt,key}` |
| Tiến trình | Không có: không API, không systemd unit, không database, không đăng nhập |

Đường dẫn không phải file (`/`, `/tre-em`, `/nguoi-lon`, `/truyen/<slug>`) nhận `index.html` (SPA). `/assets/` (tên có
hash) cache một năm; mọi file khác, kể cả `/stories/`, trả `Cache-Control: no-cache`. Một file thiếu dưới `/assets/`
hay `/stories/` là 404 thật, không phải `index.html`.

Các file: [`infra/nginx/truyen.hoandat.com.conf`](../infra/nginx/truyen.hoandat.com.conf),
[`infra/deploy.sh`](../infra/deploy.sh).

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

```sh
SSH_TARGET=<alias> [SSH_OPTS="-F <ssh_config>"] bash infra/deploy.sh release
```

Script từ chối chạy khi cây làm việc còn thay đổi chưa commit (bản release mang tên commit `HEAD`). Sau đó chạy
`pnpm lint`, `typecheck`, `test`, `build` trên máy dev; kiểm dung lượng trống trên máy chủ (phải còn kích thước bản
build cộng 1 GB, không thì dừng trước khi gửi); gửi `apps/web/dist` vào `releases/<thời điểm>-<commit>` (file giống
bản đang chạy được hard link, nên media của truyện chỉ tốn đĩa một lần); trỏ `current` sang bản mới bằng một lần
`mv -T` (không có lúc nào site trỏ vào thư mục dở dang); rồi kiểm `/`, `/tre-em`, `/stories/index.json` qua nginx trên
chính máy chủ. Một đường dẫn không trả 200 thì `current` quay về bản trước và script thoát mã 1. Giữ 5 bản gần nhất.
Không cần reload nginx khi release.

Kiểm sau release (từ ngoài, qua Cloudflare):

```sh
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

Không cần reload nginx. Gỡ hẳn app: xoá `/etc/nginx/conf.d/truyen.hoandat.com.conf` (`nginx -t` rồi reload), xoá
`/var/www/truyen`, xoá bản ghi DNS `truyen`.

## Chưa quảng bá và cách ra mắt

Một công tắc duy nhất: `INDEXABLE` trong [`apps/web/site-indexing.ts`](../apps/web/site-indexing.ts). Khi là
`false` (hiện tại), bản build có cả ba tín hiệu:

| Tín hiệu | Từ đâu |
|---|---|
| `robots.txt` với `Disallow: /` | Bản build ghi |
| `<meta name="robots" content="noindex, nofollow">` trong `index.html` | Bản build ghi |
| Header `X-Robots-Tag: noindex, nofollow` trên mọi response | nginx gửi khi bản release đang chạy có file đánh dấu `/noindex` (bản build ghi); không có file thì không gửi |

**Ra mắt:** đổi `INDEXABLE` thành `true`, commit, chạy `deploy.sh release`. Bản build mới cho phép robot, bỏ thẻ meta và
file đánh dấu, nginx thôi gửi header; không sửa gì trên máy chủ. Sau đó purge cache `robots.txt` trên Cloudflare nếu
cần ngay. Quảng bá (link từ app khác, app switcher, sitemap) là việc riêng, làm sau khi ra mắt.

## Log

nginx: `/var/log/nginx/truyen.hoandat.com.{access,error}.log`.
