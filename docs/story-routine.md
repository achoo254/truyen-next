# Routine viết truyện (phần chữ)

Routine chạy trên cloud viết khoảng 100 truyện mỗi tuần (mục tiêu đặt 01/11/2026), chỉ phần chữ: lời kể mới, phụ đề,
prompt và seed để máy nhà (PC) sinh tranh, cảnh động, giọng và nhạc sau. Mỗi push lên `main` có CI xanh là tự deploy
([`deployment-guide.md`](deployment-guide.md)), nên truyện vừa commit lên web ngay dưới dạng bản đọc chữ.

Nguồn sự thật về định dạng và luật kệ: [`story-format.md`](story-format.md),
`packages/story/src/story-schema.ts`, `packages/story/src/validate-story.ts`. Tài liệu này chỉ nói routine làm gì và
theo thứ tự nào; luật trong code thắng nếu hai bên lệch nhau.

## Danh mục ứng viên: `catalog/stories.json`

Mảng JSON, mỗi dòng một mục, **thứ tự trong tệp là thứ tự viết**:

```json
{"slug": "con-ngong-vang", "title": "Con ngỗng vàng", "shelf": "world", "origin": "world", "plotSource": "Anh em Grimm, Kinder- und Hausmärchen (bản 1857), Project Gutenberg, phạm vi công cộng", "status": "idea"}
```

| Trường | Ý nghĩa |
| --- | --- |
| `slug` | Tên thư mục `stories/<slug>/`: chữ thường không dấu, gạch nối. Không bao giờ xoá hay đổi tên slug đã có. |
| `title` | Tên truyện tiếng Việt; `story.json` dùng đúng tên này. |
| `shelf` | Một trong `SHELVES` của gói story (hiện là `kids`, `adults`, `world`). |
| `origin` | `vn-folk` (văn học dân gian, sách cổ Việt Nam) hoặc `world` (truyện dân gian, cổ tích, ngụ ngôn các nước). |
| `plotSource` | Nguồn cốt truyện và căn cứ phạm vi công cộng, ví dụ "Truyện cổ tích dân gian Việt Nam, truyền miệng, không ai giữ quyền". |
| `status` | `idea` chưa viết · `text` có `story.json`, chưa có file media nào · `media` đã có một phần tranh, cảnh động, giọng hoặc nhạc · `live` có bản âm thanh liền (`track`), nghe được cả truyện. |

`pnpm check:stories` (nằm trong `pnpm lint`) kiểm danh mục cùng các truyện:

- **Lỗi (CI đỏ):** tệp không đọc được; mục sai dạng (trường lạ, slug có dấu, kệ ngoài `SHELVES`, `origin` hay `status`
  lạ, `plotSource` dưới 20 ký tự); slug hoặc tên truyện trùng; mục có `status` khác `idea` mà không có
  `stories/<slug>/story.json`.
- **Cảnh báo (in `!`, không làm đỏ):** thư mục truyện chưa có mục trong danh mục; mục còn `idea` mà thư mục đã có; kệ,
  trạng thái hay tên trong danh mục khác với truyện. Đó là lúc danh mục chậm hơn truyện (truyện viết ngoài routine,
  media do `pnpm story:build` tạo); routine dọn chúng ở bước 1.

## Mỗi lần chạy

1. **Lấy bản mới nhất và dọn cảnh báo.** `git pull --rebase` trên `main`, `pnpm install --frozen-lockfile`, rồi
   `pnpm check:stories`. Với mỗi cảnh báo, sửa danh mục cho khớp thực tế: thêm mục cho thư mục chưa có (đúng slug, tên,
   kệ của truyện; `origin` và `plotSource` theo `source`/`basedOn` của truyện), đặt `status` và `shelf` theo thư mục.
   Không sửa truyện của người khác để khớp danh mục.

   Trong sandbox cloud, `pnpm install` có thể lỗi 403 khi tải tarball `codeload.github.com/achoo254/shared-next`
   (proxy chỉ cho đọc qua git). Khi đó: `git clone https://github.com/achoo254/shared-next` ra ngoài repo, checkout
   đúng commit ghi trong `pnpm-lock.yaml`; chép repo (trừ `.git`, `node_modules`) sang thư mục tạm, trong bản chép đổi
   các phụ thuộc `github:achoo254/shared-next#…&path:/packages/<gói>` ở `package.json` và `apps/web/package.json`
   thành `file:<đường dẫn bản clone>/packages/<gói>`, `pnpm install` rồi chạy bước kiểm ở đó. Chỉ chép
   `stories/` và `catalog/stories.json` về repo thật; không commit `package.json` hay lockfile đã đổi.
2. **Chọn lô.** Lấy các mục `idea` đầu tiên theo thứ tự trong tệp (khoảng 15 mục mỗi ngày, hay 100 mục mỗi tuần).
   Trước khi viết một mục, kiểm `stories/<slug>` trên `main` mới nhất: đã có thư mục thì **không viết lại**, chỉ cập
   nhật mục đó (bước 1) và lấy mục kế. Không chắc nguồn của một mục thuộc phạm vi công cộng thì bỏ qua (để nguyên
   `idea`) và ghi vào báo cáo của lần chạy.
3. **Viết `stories/<slug>/story.json`** theo [`story-format.md`](story-format.md), chỉ phần chữ:
   - `schemaVersion: 1`, `slug` và `title` đúng như danh mục, `shelf` theo mục 4, `language: "vi"`,
     `added` là ngày chạy theo giờ Việt Nam (`YYYY-MM-DD`; trang kệ xếp "Mới nhất" theo trường này).
   - `summary` một đến ba câu; `themes` một đến ba chủ đề trong `THEMES` của schema.
   - `source`: một hai câu nói gốc truyện (lấy từ `plotSource`) và cách viết lời kể. `basedOn` (schema bắt buộc,
     3–80 ký tự): nguồn ngắn gọn, hiện trên trang thành "Cốt truyện theo: …", ví dụ "Truyện dân gian Việt Nam",
     "Truyền kỳ mạn lục", "Truyện cổ Grimm (1857)", "Ngụ ngôn Aesop". Truyện thiếu `source` hay `basedOn` bị từ chối.
   - Lời kể mới bằng giọng của mình (`narration`) và `subtitles` (mỗi dòng tối đa 90 ký tự, ghép lại đúng bằng lời kể).
   - Prompt tiếng Anh và seed (số nguyên 0–4294967295, mỗi seed trong truyện một khác) cho từng việc PC sẽ làm:
     `style`, `characters[].sheetPrompt`, `scenes[].image.prompt`, `scenes[].video.motionPrompt`, `music.prompt` và
     `durationSeconds`; `voice: {}` cho mỗi cảnh. **Không ghi trường `file` nào** và không có `track`: chúng chỉ có
     khi `pnpm story:build` đã tạo file.
4. **Luật kệ** (kiểm bằng `pnpm check:stories`):

   | | `kids` | `adults` | `world` |
   | --- | --- | --- | --- |
   | Dành cho | Truyện Việt kể nhẹ cho trẻ nhỏ | Truyện Việt kể đầy đủ, theo sát truyện xưa | Truyện các nước kể nhẹ cho cả nhà |
   | Số cảnh | 6–10 | 8–14 | 4–12 |
   | Đọc to (ước tính) | 3–6 phút | 6–12 phút | 2–8 phút |
   | Người kể | `miu` (Mèo Miu, giọng Trúc Ly) kể cảnh đầu và cảnh cuối, người kể chuyện giọng Quỳnh Anh | Đúng một người kể, giọng Thanh Bình (không phải Trúc Ly, Quỳnh Anh, Mỹ Duyên) | Đúng một người kể, giọng Mỹ Duyên |
   | Từ cấm trong tên, tóm tắt, lời kể | "giết", "máu", "chết", "chém", "thi thể", "xác chết", "ghê rợn", "rùng rợn" | Không có | Như `kids` |
   | Từ cấm trong prompt | Như `world` và thêm "dead", "death", "kill", "sword", "spear"… | "blood", "gore", "corpse", "severed", "wound", "skull"… | Như `kids` |

   - **Mèo Miu chỉ ở kệ `kids`**: kệ khác không có người kể `miu`, không có nhân vật `miu`.
   - Mọi kệ: không có chữ số trong lời kể (viết "ba", "một trăm"); không dùng các giọng Ngọc Trân, Quang Sơn, Thùy
     Dung, Minh Triết.
   - Kệ: `origin: vn-folk` lên `kids` hoặc `adults` theo nội dung (cái chết, bạo lực, chuyện tình bi thương ⇒ `adults`;
     truyện nhẹ ⇒ `kids`, kể vòng qua chi tiết đáng sợ). `SHELVES` đã có `world`, nên mọi mục `origin: world` lên kệ
     `world` theo luật kệ đó; mục `origin: world` nào trong danh mục còn ghi `kids` hay `adults` thì sửa thành `world`.
     Một truyện thế giới không thể kể nhẹ nhàng mà vẫn đúng cốt truyện thì bỏ qua và ghi vào báo cáo.
   - Từ cấm chỉ là lưới chặn sơ suất; giọng kể phải hợp kệ ngay từ đầu.
5. **Bản quyền.** Chỉ lấy cốt truyện đã thuộc phạm vi công cộng: văn học dân gian không ai giữ quyền; sách cổ (Lĩnh Nam
   chích quái, Việt điện u linh, Truyền kỳ mạn lục, Nam Hải dị nhân liệt truyện…); Grimm, Andersen, Aesop, Perrault,
   Andrew Lang Fairy Books, Nghìn lẻ một đêm, Pushkin, truyện dân gian Nga, Nhật, Anh, Na Uy… Không lấy truyện của tác
   giả còn được bảo hộ. **Không chép nguyên văn bản dịch nào**, kể cả bản dịch đã hết hạn: các bản dịch quốc ngữ hiện
   hành của Lĩnh Nam chích quái, lời và dị bản của Nguyễn Đổng Chi (Kho tàng truyện cổ tích Việt Nam, còn bảo hộ tới hết
   31/12/2034), các bản dịch Grimm, Andersen tiếng Việt, sách giáo khoa. Không dùng chi tiết riêng của phim Disney.
6. **Kiểm.** `pnpm check:stories` tới khi mọi truyện của lô có dấu ✓ và không còn lỗi; rồi gate
   `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, chạy lần lượt, không song song.
7. **Ghi trạng thái, commit và push từng truyện.** Lượt chạy có thể bị dừng giữa chừng (hết hạn mức), nên truyện nào
   qua `pnpm check:stories` thì commit và push ngay, không chờ cả lô: đổi `status` mục đó thành `text`, một commit gồm
   `stories/<slug>/story.json` và `catalog/stories.json`, ví dụ `feat(stories): add vi-sao-ho-co-van`,
   `git pull --rebase` rồi push. Gate đầy đủ (`lint`, `typecheck`, `test`, `build`) chạy ít nhất một lần trước push
   đầu tiên của lượt; CI chạy lại mỗi push. Deploy xếp hàng (không huỷ nhau); sau push cuối, kiểm
   `https://truyen.hoandat.com/RELEASE` trả đúng mã bản mới (`<YYYYMMDD-HHMMSS>-<12 ký tự commit>`).

Việc PC làm sau (không phải routine): `pnpm story:build <slug>` sinh media và ghi `file`; ai chạy bước đó đổi `status`
thành `media`, rồi `live` khi có `track`.

## Truyện chỉ có chữ hiện trên web và app thế nào (bản đọc chữ)

- **Kệ và trang chủ:** truyện hiện như mọi truyện khác, với bìa khắc (biểu tượng truyện và tên trong khung giấy) cho
  tới khi có tranh. Trang chủ có mỗi kệ một hàng 12 bìa cuộn ngang và link sang kệ.
- **Trang truyện `/truyen/<slug>`:** render sẵn khi build, có tiêu đề, mô tả, JSON-LD và nguyên lời truyện trong HTML
  (máy tìm kiếm đọc được), dòng "Cốt truyện theo: …" từ `basedOn`. Nút chính ghi "Đọc truyện" (có giọng rồi thì tự
  đổi thành "Nghe truyện").
- **Trình đọc:** sách lật trang như truyện có media; cảnh chưa có tranh hiện nền trơn với tên cảnh; lời kể hiện thành
  chữ trên trang; tự lật trang theo thời gian đọc ước tính (tắt được trong tuỳ chọn), không có tiếng. App iPhone dùng
  cùng bản build và cùng dữ liệu, nên hiện y như web.

## Khi kệ có hàng trăm truyện

Đã kiểm (01/11/2026), chưa cần đổi bố cục: trang kệ (`/tre-em`, `/nguoi-lon`, `/the-gioi`) hiện 24 truyện một lần,
nút "Xem thêm" thêm 24 (tới 50 lần, tức 1.200 truyện mỗi kệ); có tìm không dấu, lọc độ dài và chủ đề, xếp mới nhất
(theo `added`), A–Z, ngắn nhất; trạng thái nằm trong địa chỉ. Trang chủ chỉ hiện 12 bìa mỗi kệ.

Việc tiếp theo cần theo dõi khi danh mục lên kệ:

- Nhiều truyện cùng một ngày `added` thì "Mới nhất" xếp chúng theo A–Z chứ không theo thứ tự viết.
- Kệ `world` sẽ dài nhất (khoảng 240 truyện trong danh mục): bộ lọc chủ đề tám mục có thể cần thêm cách lọc theo nước
  hay tuyển tập (Grimm, Andersen, Aesop…). Chưa làm; cần quyết khi kệ thật sự đông.
- `/stories/index.json` và các trang kệ render sẵn lớn dần theo số truyện; xem lại kích thước khi qua vài trăm truyện.
