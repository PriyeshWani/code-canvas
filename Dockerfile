# Build frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Production image
FROM node:22-alpine
WORKDIR /app

# Copy backend
COPY package*.json ./
RUN npm install --production
COPY src/ ./src/

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 3002

CMD ["node", "src/api/server.js"]
