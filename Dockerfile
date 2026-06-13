# === Stage 1: Build the Frontend ===
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# === Stage 2: Run the Backend ===
FROM node:20-alpine
WORKDIR /app

# Install git and docker CLI inside the container so it can trigger the sandbox
RUN apk add --no-cache docker-cli git

# Copy backend package files and install dependencies
COPY backend/package*.json ./backend/
RUN npm install --prefix backend --only=production

# Copy backend source code
COPY backend/ ./backend


# Copy the built frontend files from Stage 1 into the backend's static directory
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose Port 5000 (which our backend runs on)
EXPOSE 5000

# Start the server
CMD ["node", "backend/server.js"]