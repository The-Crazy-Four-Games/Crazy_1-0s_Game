FROM node:20-alpine AS builder

WORKDIR /app

# Copy root configurations
COPY package.json package-lock.json ./

# Copy workspace package.json files
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/

# Install dependencies (will run npm ci effectively loading workspaces)
RUN npm ci

# Copy the rest of the source code
COPY shared/ ./shared/
COPY frontend/ ./frontend/

# Build shared and then frontend
RUN npm run build --workspace=shared || true
RUN npm run build --workspace=frontend

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy the generated frontend build output to Nginx's web root
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Copy our custom Nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
