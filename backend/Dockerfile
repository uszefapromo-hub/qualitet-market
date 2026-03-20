FROM node:18-alpine

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Run migrations then start server
CMD ["sh", "-c", "node backend/migrations/migrate.js && node server.js"]
