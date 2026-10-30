# Định dạng truyện: `stories/<slug>/story.json`

Mỗi truyện là một thư mục `stories/<slug>/` (slug viết thường, gạch nối, trùng tên thư mục) gồm `story.json` và thư
mục `media/` do `pnpm story:build` tạo. Schema và luật kiểm: `packages/story/src/story-schema.ts`,
`packages/story/src/validate-story.ts`. `pnpm check:stories` (nằm trong `pnpm lint`) và `pnpm build` kiểm mọi truyện.

## Trường chính

| Trường | Ý nghĩa |
| --- | --- |
| `shelf` | Kệ của truyện, bắt buộc: `kids` (Trẻ em) hoặc `adults` (Người lớn). Mỗi kệ có luật riêng ở dưới. |
| `themes` | Không bắt buộc: 1–3 chủ đề cho bộ lọc của kệ, trong `than-thoai`, `su-tich`, `anh-hung`, `thien-ac`, `gia-dinh`, `tinh-yeu`, `thien-nhien`. |
| `added` | Không bắt buộc: ngày truyện lên kệ (`YYYY-MM-DD`), cho thứ tự "Mới nhất". |
| `source` | Truyện lấy từ đâu (truyện dân gian, sách cổ nào) và cách viết lời kể. |
| `style` | Phong cách vẽ thêm vào cuối mọi prompt tranh, để cả truyện như một quyển sách. Kệ Trẻ em: tranh truyện thiếu nhi màu nước; kệ Người lớn có thể trầm hơn (ví dụ tranh lụa cổ), vẫn không máu me. |
| `narrators` | Người kể: tên hiện trên phụ đề và giọng VieNeu có sẵn. Kệ Trẻ em: `miu` (Mèo Miu, giọng Trúc Ly) và người kể chuyện giọng Quỳnh Anh. Kệ Người lớn: một người kể chuyện, giọng Thanh Bình. |
| `characters[]` | Bảng nhân vật: `sheetPrompt`, `seed`, `refImage` (ảnh có sẵn để vẽ theo), `file` khi đã vẽ. |
| `scenes[]` | Mỗi cảnh: `title`, `narrator`, `narration` (câu giọng đọc), `subtitles` (các dòng phụ đề, ghép lại đúng bằng `narration`), `image` (`prompt`, `seed`, `character` làm `--ref`, `file`), `video` (`motionPrompt`, `seed`, `file`), `voice.file`. |
| `music` | Nhạc nền cả truyện: `prompt`, `durationSeconds`, `seed`, `file`. |

`file` chỉ được ghi khi file đã có (script dựng tự ghi sau mỗi bước), nên app không bao giờ đòi file chưa tồn tại.

## Luật kiểm

Thời gian đọc to ước tính theo nhịp 2,4 tiếng/giây, nghỉ 0,5 giây sau mỗi câu (cùng nhịp cho hai kệ).

| | Kệ Trẻ em (`kids`) | Kệ Người lớn (`adults`) |
| --- | --- | --- |
| Số cảnh | 6 đến 10 | 8 đến 14 |
| Đọc to | 3 đến 6 phút | 6 đến 12 phút |
| Người kể | Mèo Miu (`miu`, giọng Trúc Ly) kể cảnh đầu và cảnh cuối; người kể chuyện giọng Quỳnh Anh | Đúng một người kể, giọng khác Trúc Ly và Quỳnh Anh; không có Mèo Miu (không người kể, không nhân vật `miu`) |
| Nội dung | Kể lại nhẹ nhàng cho trẻ nhỏ: không bạo lực, máu me, cảnh chết hay chi tiết đáng sợ. Lời kể không được có các từ "giết", "máu", "chết", "chém", "thi thể", "xác chết", "ghê rợn", "rùng rợn"; prompt tranh, cảnh động, nhân vật không có "dead", "death", "kill", "sword", "spear", "blood", "gore"… | Kể đầy đủ, theo sát truyện xưa; được nói đến cái chết. Prompt không có "blood", "gore", "corpse", "severed", "wound", "skull"… |

Danh sách từ là lưới chặn sơ suất, không thay việc viết lời kể cho đúng kệ. Danh sách đầy đủ ở
`packages/story/src/validate-story.ts`.

Cả hai kệ:

- Không dùng bốn giọng VieNeu mà nhận dạng giọng nói nghe kém: Ngọc Trân, Quang Sơn, Thùy Dung, Minh Triết.
- Không có chữ số trong lời kể (giọng đọc đọc sai số): viết "một trăm", "chín".
- Mỗi dòng phụ đề tối đa 90 ký tự; các dòng ghép lại đúng bằng lời kể.
- Đường dẫn media nằm trong thư mục truyện: `media/….webp` (tranh), `.mp4` (cảnh động, không tiếng), `.m4a` (giọng, nhạc).

## Trình xem

Trang chủ `/` có hai kệ, Trẻ em trước rồi Người lớn; `/tre-em` và `/nguoi-lon` mở riêng từng kệ. Trang truyện ghi kệ
của truyện, nút quay lại về đúng kệ đó.

`/truyen/<slug>`: phát từng cảnh, phụ đề luôn hiện, nút tạm dừng, cảnh trước/sau, tắt/bật tiếng. Cảnh có giọng thì
chạy theo giọng; chưa có giọng thì chạy theo đồng hồ của trình duyệt với thời gian đọc ước tính. Dòng phụ đề đổi theo
tỷ lệ số tiếng của từng dòng. Chỉ cảnh đang xem nạp tranh, cảnh động và giọng; tranh của cảnh sau được tải trước.
Chưa có tranh thì hiện nền trơn với tên cảnh, không có hình thay thế.
