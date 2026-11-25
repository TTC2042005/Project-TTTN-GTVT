# PlantUML Use Case Diagrams

Các sơ đồ use case của Film Lab Ecosystem được tách theo miền để dễ đọc và dễ đưa vào báo cáo:

- `00-overview.puml`: use case tổng quan đơn giản và actor chính.
- `01-authentication.puml`: đăng ký, đăng nhập, đăng xuất, hồ sơ.
- `02-film-lab-booking.puml`: tìm lab, booking, thanh toán, theo dõi đơn và vận hành lab.
- `03-marketplace.puml`: listing, yêu thích, mua hàng, trạng thái đơn và review.
- `04-community-events.puml`: bài viết, bình luận, workshop, photowalk và đăng ký.
- `05-ai-image.puml`: recommendation, semantic search, chatbot/RAG và upload/ảnh.
- `06-admin-reporting.puml`: admin overview/orders và báo cáo theo quyền.
- `07-erd-database.puml`: mô hình ERD PostgreSQL, gồm các bảng và quan hệ chính.
- `08-erd-overview-simple.puml`: ERD rút gọn, hiển thị 23 bảng và các quan hệ chính.
- `09-erd-report-overview.puml`: ERD các bảng chính, phân theo 6 nhóm nghiệp vụ trong báo cáo.
- `10-checkout-payment.puml`: checkout dịch vụ Film Lab và đơn Marketplace, gồm các phương thức thanh toán.
- `19-sequence-overview.puml`: sequence diagram rút gọn cho các luồng chính toàn hệ thống.

Mở từng file bằng PlantUML extension trong VS Code để preview hoặc export PNG/SVG. Sơ đồ use case tổng quan là bản tóm tắt; dùng các sơ đồ theo miền để đọc quan hệ `<<include>>` và `<<extend>>`.

## Biểu đồ hoạt động

Các biểu đồ hoạt động chi tiết cho luồng đăng nhập, đặt dịch vụ/thanh toán, mua marketplace, đăng ký sự kiện, tải ảnh và xử lý đơn Film Lab nằm trong [`../uml-activity/`](../uml-activity/):

- `00-api-request-flow.puml`: luồng xử lý API tổng quát, gồm nhánh xác thực và Stripe webhook.
- `01-authentication.puml`
- `02-film-lab-booking-payment.puml`
- `03-marketplace-purchase.puml`
- `04-event-registration.puml`
- `05-image-upload-review.puml`
- `06-film-lab-order-processing.puml`

## Quy ước

- `<<include>>`: hành vi luôn được thực hiện như một phần của use case chính.
- `<<extend>>`: hành vi tùy chọn hoặc chỉ xảy ra trong một điều kiện mở rộng use case chính.
- Đường liên kết nét đứt tới external actor thể hiện dịch vụ ngoài tham gia luồng.
- Ghi chú trong sơ đồ phân biệt chức năng hiện có, placeholder và giới hạn prototype; sơ đồ không thay thế kiểm thử nghiệm thu.
