FROM node:20-alpine
WORKDIR /app
# Install build tools needed for native modules (bcrypt, sharp, etc.)
RUN apk add --no-cache python3 make g++ build-base && \
	python3 -m ensurepip || true
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]
