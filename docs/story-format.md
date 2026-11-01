# Định dạng truyện: `stories/<slug>/story.json`

Mỗi truyện là một thư mục `stories/<slug>/` (slug viết thường, gạch nối, trùng tên thư mục) gồm `story.json` và thư
mục `media/` do `pnpm story:build` tạo. Schema và luật kiểm: `packages/story/src/story-schema.ts`,
`packages/story/src/validate-story.ts`. `pnpm check:stories` (nằm trong `pnpm lint`) và `pnpm build` kiểm mọi truyện.

## Trường chính

| Trường | Ý nghĩa |
| --- | --- |
| `shelf` | Kệ của truyện, bắt buộc: `kids` (Trẻ em), `adults` (Người lớn) hoặc `world` (Thế giới: cổ tích, ngụ ngôn các nước). Mỗi kệ có luật riêng ở dưới. |
| `themes` | Không bắt buộc: 1–3 chủ đề cho bộ lọc của kệ, trong `than-thoai`, `su-tich`, `anh-hung`, `thien-ac`, `gia-dinh`, `tinh-yeu`, `thien-nhien`, `ngu-ngon`. |
| `added` | Không bắt buộc: ngày truyện lên kệ (`YYYY-MM-DD`), cho thứ tự "Mới nhất". |
| `source` | Truyện lấy từ đâu (truyện dân gian, sách cổ nào) và cách viết lời kể. |
| `basedOn` | Bắt buộc, 3–80 ký tự: nguồn cốt truyện ngắn gọn, hiện trên trang truyện thành "Cốt truyện theo: …" (ví dụ "Truyện cổ Grimm (1812)", "Ngụ ngôn Aesop"). Truyện không có nguồn thuộc phạm vi công cộng thì không kể. |
| `style` | Phong cách vẽ thêm vào cuối mọi prompt tranh, để cả truyện như một quyển sách. Kệ Trẻ em: tranh truyện thiếu nhi màu nước; kệ Người lớn có thể trầm hơn (ví dụ tranh lụa cổ), vẫn không máu me. |
| `narrators` | Người kể: tên hiện trên phụ đề và giọng VieNeu có sẵn. Kệ Trẻ em: `miu` (Mèo Miu, giọng Trúc Ly) và người kể chuyện giọng Quỳnh Anh. Kệ Người lớn: một người kể chuyện, giọng Thanh Bình. |
| `characters[]` | Bảng nhân vật: `sheetPrompt`, `seed`, `refImage` (ảnh có sẵn để vẽ theo), `file` khi đã vẽ. |
| `scenes[]` | Mỗi cảnh: `title`, `narrator`, `narration` (câu giọng đọc), `subtitles` (các dòng phụ đề, ghép lại đúng bằng `narration`), `image` (`prompt`, `seed`, `character` làm `--ref`, `file`), `video` (`motionPrompt`, `seed`, `file`), `voice.file`. |
| `music` | Nhạc nền cả truyện: `prompt`, `durationSeconds`, `seed`, `file`. |
| `track` | Không bắt buộc: cả truyện thành một bản âm thanh liền (`media/story.m4a`), do `pnpm story:build <slug> --only track` ghép từ giọng kể các cảnh và nhạc nền. `file`, `duration` (giây) và `scenes[]` (`id`, `start`, `end`: giọng của cảnh bắt đầu và hết ở giây nào), theo đúng thứ tự cảnh. |

`file` chỉ được ghi khi file đã có (script dựng tự ghi sau mỗi bước), nên app không bao giờ đòi file chưa tồn tại.

## Luật kiểm

Thời gian đọc to ước tính theo nhịp 2,4 tiếng/giây, nghỉ 0,5 giây sau mỗi câu (cùng nhịp cho mọi kệ).

| | Kệ Trẻ em (`kids`) | Kệ Người lớn (`adults`) | Kệ Thế giới (`world`) |
| --- | --- | --- | --- |
| Số cảnh | 6 đến 10 | 8 đến 14 | 4 đến 12 |
| Đọc to | 3 đến 6 phút | 6 đến 12 phút | 2 đến 8 phút |
| Người kể | Mèo Miu (`miu`, giọng Trúc Ly) kể cảnh đầu và cảnh cuối; người kể chuyện giọng Quỳnh Anh | Đúng một người kể, giọng khác Trúc Ly, Quỳnh Anh và Mỹ Duyên; không có Mèo Miu (không người kể, không nhân vật `miu`) | Đúng một người kể, giọng Mỹ Duyên; không có Mèo Miu |
| Nội dung | Kể lại nhẹ nhàng cho trẻ nhỏ: không bạo lực, máu me, cảnh chết hay chi tiết đáng sợ. Lời kể không được có các từ "giết", "máu", "chết", "chém", "thi thể", "xác chết", "ghê rợn", "rùng rợn"; prompt tranh, cảnh động, nhân vật không có "dead", "death", "kill", "sword", "spear", "blood", "gore"… | Kể đầy đủ, theo sát truyện xưa; được nói đến cái chết. Prompt không có "blood", "gore", "corpse", "severed", "wound", "skull"… | Cổ tích, ngụ ngôn các nước kể nhẹ nhàng cho cả nhà: cùng danh sách từ cấm trong lời kể và prompt như kệ Trẻ em |

Danh sách từ là lưới chặn sơ suất, không thay việc viết lời kể cho đúng kệ. Danh sách đầy đủ ở
`packages/story/src/validate-story.ts`.

Cả hai kệ:

- Không dùng bốn giọng VieNeu mà nhận dạng giọng nói nghe kém: Ngọc Trân, Quang Sơn, Thùy Dung, Minh Triết.
- Không có chữ số trong lời kể (giọng đọc đọc sai số): viết "một trăm", "chín".
- Mỗi dòng phụ đề tối đa 90 ký tự; các dòng ghép lại đúng bằng lời kể.
- `track` chỉ có khi mọi cảnh đã có giọng và truyện đã có nhạc; liệt kê mọi cảnh theo thứ tự, giọng cảnh sau không
  bắt đầu trước khi giọng cảnh trước hết, giọng cuối hết trước `duration`.
- Đường dẫn media nằm trong thư mục truyện: `media/….webp` (tranh), `.mp4` (cảnh động, không tiếng), `.m4a` (giọng, nhạc).

## Trình xem

Trang chủ `/` có ba kệ: Trẻ em, Người lớn, Thế giới; `/tre-em`, `/nguoi-lon` và `/the-gioi` mở riêng từng kệ. Danh mục truyện đã có và truyện ứng viên: [`story-catalogue.md`](story-catalogue.md). Trang truyện ghi kệ
của truyện, nút quay lại về đúng kệ đó.

`/truyen/<slug>`: phát từng cảnh, phụ đề luôn hiện, nút tạm dừng, cảnh trước/sau, tắt/bật tiếng. Cảnh có giọng thì
chạy theo giọng; chưa có giọng thì chạy theo đồng hồ của trình duyệt với thời gian đọc ước tính. Dòng phụ đề đổi theo
tỷ lệ số tiếng của từng dòng. Chỉ cảnh đang xem nạp tranh, cảnh động và giọng; tranh của cảnh sau được tải trước.
Chưa có tranh thì hiện nền trơn với tên cảnh, không có hình thay thế.

### Bản âm thanh liền (`track`)

Bản ghép: 1,5 giây nhạc mở đầu, giọng từng cảnh nối nhau cách 1,2 giây (lúc lật trang), 3 giây nhạc kết. Nhạc lặp
cho đủ dài, ở mức 0,3 rồi bị giọng ép nhỏ thêm khi có người kể (sidechain), mờ vào đầu và mờ ra cuối. Mốc thời gian
đo từ độ dài thật của từng file giọng (`ffprobe`), không phải ước tính. Bước này chạy trên máy dev, không cần máy
nhà; làm lại tự động khi một file giọng hoặc nhạc mới hơn bản ghép (`--force` để làm lại bất kể).

Truyện có `track` thì trình đọc phát đúng một thẻ `<audio>` cho cả truyện và lật trang theo thời gian của nó, không
dùng đồng hồ JavaScript: trang ẩn hay máy khoá thì truyện vẫn đi tiếp. Cảnh trước/sau, chọn cảnh, nghe lại đều tua bản
ghép tới đầu cảnh (cảnh một: về giây 0 để nghe nhạc mở đầu). Tắt "tự lật trang" thì dừng ở cuối giọng của cảnh. Màn
hình khoá, tai nghe (Media Session): tên cảnh, tên truyện, tranh cảnh (chưa có tranh thì biểu tượng app); phát, dừng,
cảnh trước/sau, tua. Hẹn giờ ngủ tự kiểm theo mỗi lần bản ghép báo thời gian, nên vẫn dừng đúng giờ khi máy khoá
(iOS không cho chỉnh âm lượng thẻ `<audio>`, nên trên iPhone tiếng dừng hẳn cuối mười giây mờ dần chứ không nhỏ dần).
Bản ghép không phát được thì quay về giọng từng cảnh và nhạc lặp như trước.

Thử trình đọc có tiếng khi chưa có media thật: `pnpm fixture:story <thư-mục>` chép một truyện ra thư mục khác (không
bao giờ vào `stories/`), thay giọng và nhạc bằng tiếng bíp `ffmpeg`, ghép bản liền bằng chính bước `track`; rồi
`TRUYEN_STORIES_DIR=<thư-mục>/stories pnpm dev`.
