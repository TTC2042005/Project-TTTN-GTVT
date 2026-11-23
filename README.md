# Film Lab Ecosystem

>Nền tảng capstone Next.js + Express + PostgreSQL cho nhiếp ảnh analog, film lab, marketplace, cộng đồng và AI.

## Mức độ hoàn thiện

Đây là **prototype/MVP đang phát triển**, chưa đáp ứng đầy đủ yêu cầu production. Các luồng đã có mã nguồn gồm xác thực JWT, tìm kiếm lab cơ bản, đặt dịch vụ, dashboard lab/admin, marketplace, community/event, upload ảnh với phân tích heuristic, SSE và AI fallback/RAG cơ bản. Một số luồng nghiệp vụ và bảo mật đã được siết lại nhưng cần kiểm thử tích hợp với PostgreSQL và nhà cung cấp thật trước khi nghiệm thu.

| Hạng mục | Hiện trạng |
|---|---|
| Tài khoản và vai trò | Đăng ký/đăng nhập/profile JWT; đăng ký không được tự cấp `admin`. Chưa có OAuth, xác minh email, reset mật khẩu thật hoặc rate limit. |
| Film lab / booking | Tìm/lọc, service/package, đơn hàng, lab dashboard và trạng thái SSE. Đơn lấy giá từ DB và kiểm tra lab/service/package. |
| Thanh toán | Có checkout Stripe/QR ở mức tích hợp cơ bản; webhook xác minh chữ ký khi đã cấu hình secret. Không nên bật thanh toán live trước khi test idempotency, refund, currency và đối soát. |
| Marketplace | Listing, favorite, review và order; tạo order/giảm stock có transaction + row lock. Seller listing chờ admin duyệt trước khi hiển thị; admin listing được đăng trực tiếp. |
| Community / events | Posts/comments và workshop/photowalk; đăng ký sự kiện đã publish được khóa theo event để kiểm tra capacity. |
| Admin workspace | Khu vực riêng tại `/admin`, có tổng quan, duyệt Marketplace, suất chiếu, vai trò/tài khoản và Film Lab, sự kiện/nội dung/báo cáo, đối soát giao dịch và audit log. Mọi API quản trị kiểm tra role ở backend; thao tác quan trọng được ghi vào database. |
| Ảnh số | Upload ảnh riêng tư, heuristic quality metrics, AI visual feedback khi user consent và các preset chỉnh ảnh không phá hủy bản gốc. AI không xác định chắc chắn film stock; production vẫn cần quét malware, lifecycle và kiểm thử blob access. |
| AI | Recommendation heuristic, chatbot/RAG và semantic search prototype. Chatbot dùng Gemini khi cấu hình `GEMINI_API_KEY`, đồng thời truy hồi dữ liệu hiện tại của lab/service/package, listing Marketplace, event, bài viết public và knowledge documents; OpenAI vẫn được dùng tùy chọn cho embedding/semantic search và phân tích ảnh. Elasticsearch chưa được tích hợp vào luồng tìm kiếm; RAG/vector index và đánh giá chất lượng production vẫn cần hoàn thiện. |
| Tài liệu / triển khai | Docker Compose và tài liệu SRS/architecture có. Chưa có CI, OpenAPI hoàn chỉnh, E2E/security/load test, monitoring, backup/restore và triển khai cloud được xác minh. |

## Run locally

1. Copy `.env.example` to `.env`, set a private, long random `JWT_SECRET`, and add a Gemini API key to `GEMINI_API_KEY` to enable the chatbot (never commit `.env`).
2. Install dependencies
   - cd backend && npm install
   - cd frontend && npm install
3. Start database services
   - docker compose up -d postgres elasticsearch
4. (Optional) Seed demo data
   - cd backend && node src/seed.js
   - Seeding is idempotent and does not delete existing accounts or records.
5. Start backend
   - cd backend && npm run dev
6. Start frontend
   - cd frontend && npm run dev

On Windows with Docker Desktop, `.\dev-start.ps1` starts the app and opens it in a browser. Demo data is not seeded automatically; use `.\dev-start.ps1 -SeedDemoData` only when you want the sample records.

## Required environment variables

Backend:
- DATABASE_URL
- JWT_SECRET
- FRONTEND_URL
- STRIPE_SECRET_KEY (optional)
- STRIPE_WEBHOOK_SECRET (required to accept Stripe webhooks)
- BANK_QR_URL / BANK_ACCOUNT_NAME / BANK_ACCOUNT_NUMBER / BANK_NAME (optional)
- OPENAI_API_KEY (optional)
- GEMINI_API_KEY (optional; enables Gemini in the chatbot)
- GEMINI_MODEL (optional; defaults to `gemini-2.5-flash`)
- AWS_ACCESS_KEY_ID (optional)
- AWS_SECRET_ACCESS_KEY (optional)
- AWS_S3_BUCKET (optional)
- AWS_REGION (optional)

## Demo accounts

- Photographer: photographer@example.com / password
- Lab owner: labowner@example.com / password
- Admin: admin@example.com / password

> Chỉ dùng tài khoản demo ở môi trường local. Không dùng thông tin seed, JWT secret trong Docker Compose hoặc dữ liệu mẫu cho môi trường thật.

PostgreSQL data is stored in the `postgres-data` Docker volume and survives `docker compose down`. Avoid `docker compose down -v` unless you intentionally want to delete that database.

## Các việc cần hoàn thiện trước nghiệm thu/production

1. Mở rộng unit/integration/E2E/security tests; hiện bộ test backend còn rất nhỏ và chưa chạy integration với PostgreSQL.
2. Hoàn thiện payment idempotency, đối soát QR, refund và kiểm tra luồng webhook trên Stripe sandbox.
3. Thay `sequelize.sync({ alter: true })` bằng migration có version; rà soát dữ liệu/currency và state transition khi migrate.
4. Cấu hình/kiểm thử private blob storage + signed URL; hoàn thiện lifecycle cleanup và malware scanning cho upload.
5. Hoàn thiện OAuth/reset-password, rate limiting, CORS allowlist, audit log và quản trị/kiểm duyệt.
6. Xây dựng Elasticsearch indexing/search thật; cải thiện RAG bằng vector index, nguồn trích dẫn, giới hạn input và evaluation set.
7. Bổ sung notification center/chat realtime, phân trang, OpenAPI, CI/CD, observability, backup/restore và triển khai staging.

Chi tiết yêu cầu, acceptance criteria và các phần dự kiến xem [docs/SRS.md](docs/SRS.md); kiến trúc xem [docs/architecture.md](docs/architecture.md).
