# Film Lab Ecosystem

This project is a full-stack platform for film photographers, film labs, marketplace, community, and AI assistance.

## Features implemented

- Authentication and role-based access
- Film Lab discovery and comparison
- Lab service and package booking
- Orders and payment flow
- Order tracking via Server-Sent Events
- Admin dashboard
- Upload and image quality analysis
- AI recommendations and chatbot fallback

## Run locally

1. Install dependencies
   - cd backend && npm install
   - cd frontend && npm install
2. Start database services
   - docker compose up -d postgres elasticsearch
3. Seed demo data
   - cd backend && node src/seed.js
4. Start backend
   - cd backend && npm run dev
5. Start frontend
   - cd frontend && npm run dev

## Required environment variables

Backend:
- DATABASE_URL
- JWT_SECRET
- FRONTEND_URL
- STRIPE_SECRET_KEY (optional)
- AWS_ACCESS_KEY_ID (optional)
- AWS_SECRET_ACCESS_KEY (optional)
- AWS_S3_BUCKET (optional)
- AWS_REGION (optional)

## Demo accounts

- Photographer: photographer@example.com / password
- Lab owner: labowner@example.com / password
- Admin: admin@example.com / password
