FROM node:20-alpine AS builder

WORKDIR /app

# Copy root configurations
COPY package.json package-lock.json ./

# Copy workspace package.json files
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/

# Install dependencies
RUN npm ci

# Copy the rest of the source code
COPY shared/ ./shared/
COPY backend/ ./backend/

# Build shared and then backend
RUN npm run build --workspace=shared || true
RUN npm run build --workspace=backend

# Copy non-TS assets that tsc doesn't handle
RUN cp -r backend/src/modules/db/*.sql backend/dist/modules/db/ 2>/dev/null || true

# Stage 2: Production image
FROM node:20-alpine

WORKDIR /app

# Copy built artifacts and dependencies
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

RUN npm ci --omit=dev

COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/backend/dist ./backend/dist

# Set the working directory to backend so `npm start` runs the backend scripts
WORKDIR /app/backend

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/index.js"]
