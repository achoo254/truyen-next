# App Store: quyền riêng tư và độ tuổi (bản nháp câu trả lời)

Câu trả lời đề xuất cho bảng hỏi trên App Store Connect, kèm căn cứ trong mã. Chủ dự án duyệt trước khi điền.

## App Privacy: "Data Not Collected"

Câu hỏi đầu tiên "Do you or your third-party partners collect data from this app?": **No**.

Căn cứ (kiểm 30/10/2026):

| Điều | Thực tế |
|---|---|
| Tài khoản, đăng nhập | Không có |
| Theo dõi, đo lường, quảng cáo, SDK bên thứ ba | Không có. Cloudflare Web Analytics chỉ được Cloudflare chèn vào trang **web**; trang của app nằm trong app, CSP của app không cho nạp nó (`apps/web/vite-native.ts`, test `vite-native.test.ts`) |
| Dữ liệu gửi đi | Chỉ các yêu cầu tải danh sách truyện, `story.json`, tranh và âm thanh từ `truyen.hoandat.com`, không kèm định danh nào |
| Lưu trên máy | Ngôn ngữ, tắt đèn, tuỳ chọn trình đọc, chỗ đang nghe dở, truyện đã tải: chỉ trong máy, không gửi đi |
| Liên kết ra ngoài | Qua cổng phụ huynh, mở bằng Safari |

Lưu ý: như mọi website, nginx và Cloudflare ghi nhật ký truy cập (IP, đường dẫn) để vận hành. Theo định nghĩa của
Apple ("collect" là giữ lâu hơn mức cần để trả lời yêu cầu), nhật ký vận hành không dùng để nhận dạng hay theo dõi
thường không phải khai. Nếu chủ dự án muốn chắc hơn, có thể khai "Diagnostics → Other Diagnostic Data, Not Linked to
You, App Functionality".

Không có `PrivacyInfo.xcprivacy` riêng của app: app không dùng "required reason API" nào ngoài phần của Capacitor và
plugin (các gói này tự mang manifest).

## Age Rating: mục tiêu 9+

Bảng hỏi của App Store Connect (bản 2025, thang 4+/9+/13+/16+/18+). Đề xuất:

| Câu hỏi | Trả lời | Vì sao |
|---|---|---|
| Cartoon or Fantasy Violence | Infrequent/Mild | Thần thoại có giao tranh (Sơn Tinh, Thủy Tinh dâng nước; Thánh Gióng đánh giặc), kể không máu me (`validate-story.ts` chặn từ ngữ) |
| Realistic Violence | Infrequent/Mild | Kệ Người lớn nói tới chiến tranh (Sự tích Hồ Gươm), không mô tả |
| Prolonged Graphic or Sadistic Realistic Violence | None | |
| Horror/Fear Themes | Infrequent/Mild | Bóng ma, cõi thuỷ cung trong truyện xưa |
| Mature or Suggestive Themes | None | Xem rủi ro dưới |
| Profanity or Crude Humor | None | |
| Sexual Content or Nudity / Graphic Sexual Content | None | |
| Alcohol, Tobacco, or Drug Use or References | None | |
| Medical or Treatment Information | None | |
| Simulated Gambling / Contests | None | |
| Unrestricted Web Access | No | Không có trình duyệt trong app; link ra ngoài mở Safari qua cổng phụ huynh |
| User-Generated Content, Messaging and Chat | No | |
| Advertising | No | |
| Parental Controls | No | Cổng phụ huynh không phải tính năng kiểm soát của phụ huynh |
| Age Assurance | No | |
| Made for Kids (Kids Category) | No | Có kệ Người lớn (quyết định của kế hoạch, Jev 0,94) |

Rủi ro: "Chuyện người con gái Nam Xương" kết thúc bằng việc Vũ Nương gieo mình xuống sông. Nếu người duyệt coi đây là
chủ đề tự tử, Apple có thể nâng lên 13+. Trước khi nộp: đọc lại lời kể cảnh đó (kể nhẹ, không mô tả), hoặc chấp nhận
13+ nếu bị yêu cầu.

## Ghi chú cho người duyệt (App Review Information)

Không cần tài khoản thử. Gợi ý ghi: "Truyện plays Vietnamese folk tales as illustrated, narrated scenes. Audio keeps
playing in the background (UIBackgroundModes audio) so a story can be listened to with the phone locked; lock screen
controls use the Media Session API. Stories can be downloaded for offline listening (Downloaded page, download icon in
the header). Links that leave the app are behind a parental gate (a multiplication question written in words)."
