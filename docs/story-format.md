# Định dạng truyện: `stories/<slug>/story.json`

Mỗi truyện là một thư mục `stories/<slug>/` (slug viết thường, gạch nối, trùng tên thư mục) gồm `story.json` và thư
mục `media/` do `pnpm story:build` tạo. Schema và luật kiểm: `packages/story/src/story-schema.ts`,
`packages/story/src/validate-story.ts`. `pnpm check:stories` (nằm trong `pnpm lint`) và `pnpm build` kiểm mọi truyện.

## Trường chính

| Trường | Ý nghĩa |
| --- | --- |
| `status` | `awaiting-text-review` (lời kể chờ người duyệt) hoặc `text-approved` (đã duyệt, kèm `review.approvedBy`, `review.approvedOn`). `pnpm story:build` chỉ chạy thật khi đã duyệt. |
| `style` | Phong cách vẽ thêm vào cuối mọi prompt tranh, để cả truyện như một quyển sách. |
| `narrators` | Người kể: tên hiện trên phụ đề và giọng VieNeu (`Mèo Miu` giọng Trúc Ly, người kể chuyện giọng Quỳnh Anh). |
| `characters[]` | Bảng nhân vật: `sheetPrompt`, `seed`, `refImage` (ảnh có sẵn để vẽ theo), `file` khi đã vẽ. |
| `scenes[]` | Mỗi cảnh: `title`, `narrator`, `narration` (câu giọng đọc), `subtitles` (các dòng phụ đề, ghép lại đúng bằng `narration`), `image` (`prompt`, `seed`, `character` làm `--ref`, `file`), `video` (`motionPrompt`, `seed`, `file`), `voice.file`. |
| `music` | Nhạc nền cả truyện: `prompt`, `durationSeconds`, `seed`, `file`. |

`file` chỉ được ghi khi file đã có (script dựng tự ghi sau mỗi bước), nên app không bao giờ đòi file chưa tồn tại.

## Luật kiểm

- 6 đến 10 cảnh; đọc to ước tính 3 đến 6 phút (2,4 tiếng/giây, nghỉ 0,5 giây sau mỗi câu).
- Cảnh đầu và cảnh cuối do Mèo Miu (`miu`) kể.
- Không có chữ số trong lời kể (giọng đọc đọc sai số): viết "một trăm", "chín".
- Mỗi dòng phụ đề tối đa 90 ký tự; các dòng ghép lại đúng bằng lời kể.
- Đường dẫn media nằm trong thư mục truyện: `media/….webp` (tranh), `.mp4` (cảnh động, không tiếng), `.m4a` (giọng, nhạc).

## Trình xem

`/truyen/<slug>`: phát từng cảnh, phụ đề luôn hiện, nút tạm dừng, cảnh trước/sau, tắt/bật tiếng. Cảnh có giọng thì
chạy theo giọng; chưa có giọng thì chạy theo đồng hồ của trình duyệt với thời gian đọc ước tính. Dòng phụ đề đổi theo
tỷ lệ số tiếng của từng dòng. Chỉ cảnh đang xem nạp tranh, cảnh động và giọng; tranh của cảnh sau được tải trước.
Chưa có tranh thì hiện nền trơn với tên cảnh, không có hình thay thế.
