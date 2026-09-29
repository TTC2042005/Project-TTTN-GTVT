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
- **Database**
  - PostgreSQL for transactional data
  - Elasticsearch for search indexes
  - Blob storage for scanned images / print assets
- **AI services**
  - OpenAI / Azure OpenAI for LLM
  - Semantic search with Elasticsearch
  - Recommendation engine using usage signals and metadata
  - RAG / knowledge retrieval for photography support

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
- OAuth 2.0 integration planned for social login.
- Role-based access control for photographers, lab owners, admins, and moderators.
- Secure storage of sensitive data in environment variables.

## Deployment

- Containerized services via Docker Compose.
- Production deployment can target Azure App Service, Azure Container Instances, or Kubernetes.
- Use managed PostgreSQL, Elasticsearch, and blob storage in production.

## Implementation boundary (reviewed 2026-09-29)

The component list above describes the intended architecture, not proof that every provider is connected. The current repository implements PostgreSQL/Sequelize, Express REST routes, a Next.js UI, local/S3-compatible upload code, JWT, heuristic recommendation/image metrics, and in-process realtime events. Elasticsearch is started by Docker Compose but is not yet wired into the application search/indexing path. AI embeddings currently use database document rows and in-process cosine scoring rather than a production vector index. OAuth, production email, signed private media URLs, CI/CD, centralized observability, and tested cloud deployment remain planned work.

### Order and payment trust boundaries

- Lab order totals and item prices must be resolved by the API from the selected lab's service/package records; browser-submitted prices are not authoritative.
- Marketplace orders are limited to persisted listings. Order creation and stock decrement share a database transaction and lock the product row.
- Stripe checkout completion must be accepted only after verifying `Stripe-Signature` over the raw request body with `STRIPE_WEBHOOK_SECRET`. Keep the order pending until that provider event or an approved manual-payment verification is recorded.
- Order lifecycle events are currently process-local. They work for a single backend instance; multi-instance deployments need a shared broker (for example Redis/Postgres notifications) so SSE updates reach clients connected to any instance.

### Release caveats

`sequelize.sync({ alter: true })` is a development convenience, not a production migration strategy. Replace it with versioned migrations before rollout, and verify existing enum/data changes and backups. Payment, storage, security, concurrency, and recovery behavior still require integration tests against isolated services before production use.
