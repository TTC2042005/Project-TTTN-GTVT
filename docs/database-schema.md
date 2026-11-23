# Database Schema

## Core entities

- `users`
  - id, email, password_hash, name, role, phone, avatar_url, bio, location, created_at, updated_at
- `film_labs`
  - id, owner_id, name, address, city, country, description, rating, photo_url, created_at
- `lab_services`
  - id, lab_id, name, service_type, price, duration_minutes, description, created_at
- `lab_packages`
  - id, lab_id, title, description, price, service_ids, created_at
- `orders`
  - id, user_id, lab_id, service_id, package_id, status, total_price, requested_at, due_date, tracking_code
- `order_items`
  - id, order_id, item_type, item_id, quantity, unit_price
- `products`
  - id, seller_id, title, category, condition, price, description, stock, moderation_status, created_at
- `marketplace_orders`
  - id, buyer_id, seller_id, product_id, quantity, total_price, status, payment_method, shipping_tracking, proof_upload_id, created_at
- `film_screenings`
  - id, film_title, event_date, venue_name, venue_address, capacity, ticket_price, is_published, created_at, updated_at
- `ticket_reservations`
  - id, screening_id, user_id, quantity, status (`reserved`/`cancelled`), created_at, updated_at
- `transactions`
  - id, order_id, amount, currency, payment_method, status, provider_reference, verification_status, verified_by, verified_at, verification_note, created_at
- `content_reports`
  - id, reporter_id, target_type, target_id, reason, status, resolution_note, created_at, updated_at
- `admin_audit_logs`
  - id, actor_id, action, entity_type, entity_id, details, created_at
- `reviews`
  - id, author_id, target_type, target_id, rating, review_text, created_at
- `messages`
  - id, conversation_id, sender_id, recipient_id, content, sent_at
- `posts`
  - id, author_id, title, body, tags, published_at, visibility
- `comments`
  - id, post_id, author_id, content, created_at
- `recommendations`
  - id, user_id, item_type, item_id, score, reason, created_at

## Search and AI

- `search_index_film_labs`
  - lab_id, name, address, city, description, tags, price_range, rating
- `knowledge_documents`
  - id, source, title, content, vector, metadata, created_at

## Notes

- Use relational tables for transactional operations and user data.
- User registration and profile updates are persisted in PostgreSQL; passwords are stored as bcrypt hashes.
- Docker Compose stores PostgreSQL data in the named `postgres-data` volume. `docker compose down` preserves it; do not use `docker compose down -v` unless you intend to delete local database data.
- Demo seeding is opt-in and idempotent. It does not truncate user accounts or existing records.
- Store the AI knowledge base as documents with embeddings for RAG.
- Keep user media references as URLs in the database, with actual files in blob storage.
- Film showtime records are entered by admins; the static `Flim` image catalog does not invent screening times or venues.
- One user has at most one reservation per screening. Capacity checks and reservation/cancellation updates run under a screening row lock; cancelled seats become available again.
