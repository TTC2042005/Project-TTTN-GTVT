# Film Lab Ecosystem Architecture

## Overview

The system is composed of four major domains:

1. **Customer Platform**
   - Photographer search, booking, marketplace, community, account management.
2. **Film Lab Operations**
   - Lab profile management, pricing, order processing, customer and revenue analytics.
3. **Marketplace**
   - Listings, seller reviews, transaction tracking, messaging.
4. **AI Platform**
   - Recommendations, semantic search, RAG assistant, image quality evaluation.

## Component Diagram

Sơ đồ component tổng quan có thể mở bằng PlantUML: [architecture-overview.puml](./architecture-overview.puml). Sơ đồ dữ liệu theo tầng: [database-architecture-overview.puml](./database-architecture-overview.puml); ERD chi tiết: [07-erd-database.puml](./uml-usecases/07-erd-database.puml).

Sơ đồ riêng cho Backend: [backend-architecture.puml](./backend-architecture.puml) mô tả các module và tích hợp; [backend-request-flow.puml](./backend-request-flow.puml) mô tả luồng xử lý API có xác thực.

- **Frontend (Next.js)**
  - Public marketing pages
  - Customer dashboard
  - Lab owner portal
  - Marketplace and community
- **Backend API (Node.js + Express)**
  - Auth service
  - Film lab service
  - Order service
  - Marketplace service
  - Community service
  - AI service
- **Data and file storage**
  - PostgreSQL/Sequelize for transactional and application data
  - Local disk or S3-compatible storage for image files
  - Elasticsearch exists in Docker Compose but is not connected to application search
- **AI services**
  - Google Gemini API for chatbot/RAG response generation
  - OpenAI embeddings for optional RAG document ranking and semantic-search prototype
  - OpenAI vision for optional, consent-based image feedback
  - Recommendation engine using usage signals and metadata
  - Local project-data and knowledge-document retrieval for RAG; Elasticsearch is not yet connected to this path

### Chatbot and Gemini configuration

- `POST /api/ai/rag` uses Gemini when the backend has `GEMINI_API_KEY`; `GEMINI_MODEL` selects the model and defaults to `gemini-2.5-flash`.
- The backend sends the key to Google from the server. Keep it in the ignored root `.env`; do not expose it through `NEXT_PUBLIC_*` variables or commit it.
- The chatbot retrieves current lab, service, package, Marketplace, event, community, and knowledge-document context before generating an answer. Catalog price questions may be answered deterministically from the current catalog without calling Gemini.
- If Gemini is not configured, the endpoint uses local project-data answers. When OpenAI embeddings are not configured, knowledge documents are ranked locally; this is a prototype retrieval path, not a vector database.
- OpenAI is still used by separate semantic-search and image-feedback paths when configured; those features have not been migrated to Gemini.

## Data flow

- User signs up and authenticates via JWT.
- Customers search Film Labs and compare by location, price, reviews.
- Customers place orders for film development, scanning, and printing.
- Lab owners update order status and upload scanned media.
- Marketplace users list and trade equipment, rate sellers, and message each other.
- Community users publish guides, share experiences, and join discussions.
- AI modules provide personalized lab and film recommendations, answer photography questions, and evaluate scan quality.

## Security

- JWT-based auth for API access.
- Google and Facebook OAuth 2.0 authorization-code sign-in is implemented when provider credentials and callback URLs are configured. Existing email accounts are not automatically linked.
- Role-based access control for photographers, lab owners, admins, and moderators.
- Secure storage of sensitive data in environment variables.

## Deployment

- Containerized services via Docker Compose.
- Production deployment can target Azure App Service, Azure Container Instances, or Kubernetes.
- Use managed PostgreSQL, Elasticsearch, and blob storage in production.

## Implementation boundary (reviewed 2026-11-23)

The component list above describes the intended architecture, not proof that every provider is connected. The current repository implements PostgreSQL/Sequelize, Express REST routes, a Next.js UI, local/S3-compatible upload code, JWT, heuristic recommendation/image metrics, and in-process realtime events. Elasticsearch is started by Docker Compose but is not yet wired into the application search/indexing path. The chatbot can use Gemini for generation; retrieval uses local project data and knowledge documents, with optional OpenAI embeddings and in-process cosine scoring rather than a production vector index. Production email, signed private media URLs, CI/CD, centralized observability, and tested cloud deployment remain planned work.

### Order and payment trust boundaries

- Lab order totals and item prices must be resolved by the API from the selected lab's service/package records; browser-submitted prices are not authoritative.
- Marketplace orders are limited to persisted listings. Order creation and stock decrement share a database transaction and lock the product row.
- Stripe checkout completion must be accepted only after verifying `Stripe-Signature` over the raw request body with `STRIPE_WEBHOOK_SECRET`. Keep the order pending until that provider event or an approved manual-payment verification is recorded.
- Order lifecycle events are currently process-local. They work for a single backend instance; multi-instance deployments need a shared broker (for example Redis/Postgres notifications) so SSE updates reach clients connected to any instance.

### Release caveats

`sequelize.sync({ alter: true })` is a development convenience, not a production migration strategy. Replace it with versioned migrations before rollout, and verify existing enum/data changes and backups. Payment, storage, security, concurrency, and recovery behavior still require integration tests against isolated services before production use.
