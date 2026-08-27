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
