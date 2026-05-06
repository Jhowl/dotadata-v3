FROM node:22-alpine AS deps
WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev

FROM node:22-alpine AS builder
WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN npm install
COPY shared ../shared
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npx tsc -p tsconfig.json

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY backend/package.json ./
EXPOSE 4000
CMD ["node", "dist/server.js"]
