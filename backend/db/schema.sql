-- Film Lab ecosystem database schema for PostgreSQL

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role_enum AS ENUM ('photographer', 'lab_owner', 'seller', 'admin');
CREATE TYPE order_status_enum AS ENUM ('pending', 'processing', 'completed', 'cancelled');
CREATE TYPE marketplace_order_status_enum AS ENUM ('pending', 'paid', 'confirmed', 'shipped', 'completed', 'cancelled');
CREATE TYPE post_visibility_enum AS ENUM ('public', 'private', 'draft');
CREATE TYPE event_registration_status_enum AS ENUM ('registered', 'checked_in', 'cancelled');
CREATE TYPE event_registration_type_enum AS ENUM ('workshop', 'photowalk');
CREATE TYPE transaction_status_enum AS ENUM ('pending', 'succeeded', 'failed', 'refunded');
CREATE TYPE ticket_reservation_status_enum AS ENUM ('reserved', 'cancelled');
CREATE TYPE product_moderation_status_enum AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE transaction_verification_status_enum AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE content_report_target_enum AS ENUM ('post', 'comment', 'product', 'workshop', 'photowalk');
CREATE TYPE content_report_status_enum AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');

CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  google_id TEXT UNIQUE,
  facebook_id TEXT UNIQUE,
  name TEXT NOT NULL,
  role user_role_enum NOT NULL DEFAULT 'photographer',
  avatar_url TEXT,
  phone TEXT,
  bio TEXT,
  location TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE film_labs (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  rating REAL NOT NULL DEFAULT 0,
  price_range TEXT,
  service_quality TEXT,
  photo_url TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE lab_services (
  id UUID PRIMARY KEY,
  lab_id UUID NOT NULL REFERENCES film_labs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  service_type TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  duration_minutes INTEGER,
  description TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE lab_packages (
  id UUID PRIMARY KEY,
  lab_id UUID NOT NULL REFERENCES film_labs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lab_id UUID NOT NULL REFERENCES film_labs(id) ON DELETE CASCADE,
  status order_status_enum NOT NULL DEFAULT 'pending',
  total_price REAL NOT NULL DEFAULT 0,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  tracking_code TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id UUID NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
  id UUID PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  condition TEXT,
  price REAL NOT NULL DEFAULT 0,
  description TEXT,
  stock INTEGER NOT NULL DEFAULT 1,
  moderation_status product_moderation_status_enum NOT NULL DEFAULT 'approved',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reviews (
  id UUID PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE posts (
  id UUID PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tags TEXT[],
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  visibility post_visibility_enum NOT NULL DEFAULT 'public',
  published_at TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE comments (
  id UUID PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT NOT NULL,
  status transaction_status_enum NOT NULL DEFAULT 'pending',
  provider_reference TEXT,
  verification_status transaction_verification_status_enum NOT NULL DEFAULT 'pending',
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  verification_note TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE uploads (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  url TEXT NOT NULL,
  quality JSONB,
  metadata JSONB,
  shared BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE favorites (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE marketplace_orders (
  id UUID PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  total_price REAL NOT NULL DEFAULT 0,
  status marketplace_order_status_enum NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  shipping_tracking TEXT,
  proof_upload_id UUID REFERENCES uploads(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE film_screenings (
  id UUID PRIMARY KEY,
  film_title TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  venue_name TEXT NOT NULL,
  venue_address TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  ticket_price NUMERIC(10, 2) NOT NULL CHECK (ticket_price >= 0),
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX film_screenings_title_date_idx ON film_screenings (film_title, event_date);

CREATE TABLE ticket_reservations (
  id UUID PRIMARY KEY,
  screening_id UUID NOT NULL REFERENCES film_screenings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 10),
  status ticket_reservation_status_enum NOT NULL DEFAULT 'reserved',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (screening_id, user_id)
);

CREATE INDEX ticket_reservations_screening_status_idx ON ticket_reservations (screening_id, status);

CREATE TABLE workshops (
  id UUID PRIMARY KEY,
  organizer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 20,
  published_at TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE photowalks (
  id UUID PRIMARY KEY,
  organizer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 30,
  published_at TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE event_registrations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type event_registration_type_enum NOT NULL,
  event_id UUID NOT NULL,
  status event_registration_status_enum NOT NULL DEFAULT 'registered',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_type_match CHECK (
    (event_type = 'workshop' AND event_id IS NOT NULL) OR
    (event_type = 'photowalk' AND event_id IS NOT NULL)
  )
);

CREATE TABLE content_reports (
  id UUID PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type content_report_target_enum NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status content_report_status_enum NOT NULL DEFAULT 'open',
  resolution_note TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY,
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rag_documents (
  id UUID PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'unknown',
  title TEXT,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  embedding JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_lab_id ON orders(lab_id);
CREATE INDEX idx_products_seller_id ON products(seller_id);
CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_product_id ON favorites(product_id);
CREATE INDEX idx_marketplace_orders_buyer_id ON marketplace_orders(buyer_id);
CREATE INDEX idx_marketplace_orders_seller_id ON marketplace_orders(seller_id);
CREATE INDEX idx_posts_author_id ON posts(author_id);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_author_id ON comments(author_id);
CREATE INDEX idx_reviews_target ON reviews(target_type, target_id);
CREATE INDEX idx_event_registrations_user_id ON event_registrations(user_id);
CREATE INDEX idx_event_registrations_event ON event_registrations(event_type, event_id);
CREATE INDEX idx_products_moderation_status ON products(moderation_status);
CREATE INDEX idx_transactions_verification_status ON transactions(verification_status);
CREATE INDEX idx_content_reports_status_created ON content_reports(status, "createdAt");
CREATE INDEX idx_content_reports_target ON content_reports(target_type, target_id);
CREATE INDEX idx_admin_audit_logs_created ON admin_audit_logs("createdAt");
CREATE INDEX idx_rag_documents_source ON rag_documents(source);
