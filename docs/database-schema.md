# Database Schema

## Core entities

- `users`
  - id, email, password_hash, name, role, avatar_url, created_at
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
  - id, seller_id, title, category, condition, price, description, stock, created_at
- `transactions`
  - id, order_id, amount, currency, payment_method, status, provider_reference, created_at
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
- Store the AI knowledge base as documents with embeddings for RAG.
- Keep user media references as URLs in the database, with actual files in blob storage.
