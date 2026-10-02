# PlantUML Use Case Diagrams

Các sơ đồ use case của Film Lab Ecosystem được tách theo miền để dễ đọc và dễ đưa vào báo cáo:

- `00-overview.puml`: phạm vi tổng quan và actor chính.
- `01-authentication.puml`: đăng ký, đăng nhập, đăng xuất, hồ sơ.
- `02-film-lab-booking.puml`: tìm lab, booking, thanh toán, theo dõi đơn và vận hành lab.
- `03-marketplace.puml`: listing, yêu thích, mua hàng, trạng thái đơn và review.
- `04-community-events.puml`: bài viết, bình luận, workshop, photowalk và đăng ký.
- `05-ai-image.puml`: recommendation, semantic search, chatbot/RAG và upload/ảnh.
- `06-admin-reporting.puml`: admin overview/orders và báo cáo theo quyền.

Mở từng file bằng PlantUML extension trong VS Code để preview hoặc export PNG/SVG. Sơ đồ tổng quan là bản tóm tắt; dùng các sơ đồ theo miền để đọc quan hệ `<<include>>` và `<<extend>>`.

## Quy ước

- `<<include>>`: hành vi luôn được thực hiện như một phần của use case chính.
- `<<extend>>`: hành vi tùy chọn hoặc chỉ xảy ra trong một điều kiện mở rộng use case chính.
- Đường liên kết nét đứt tới external actor thể hiện dịch vụ ngoài tham gia luồng.
- Ghi chú trong sơ đồ phân biệt chức năng hiện có, placeholder và giới hạn prototype; sơ đồ không thay thế kiểm thử nghiệm thu.
