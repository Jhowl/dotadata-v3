# Build context is the repo root so we can reach ../shared from frontend's
# tsconfig path alias. WORKDIR is /app/frontend so the relative path resolves.
FROM node:22-alpine AS deps
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /app/frontend
COPY --from=deps /app/frontend/node_modules ./node_modules
COPY shared /app/shared
COPY frontend ./
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NODE_ENV=production
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
COPY --from=builder /app/frontend/package.json ./package.json
COPY --from=builder /app/frontend/node_modules ./node_modules
COPY --from=builder /app/frontend/public ./public
COPY --from=builder /app/frontend/.next ./.next
# next.config and i18n config are read at runtime by `next start` — without
# them the image optimizer falls back to defaults (rejects every external URL
# with `"url" parameter is not allowed`) and next-intl can't resolve locales.
COPY --from=builder /app/frontend/next.config.ts ./next.config.ts
COPY --from=builder /app/frontend/src/i18n ./src/i18n
COPY --from=builder /app/frontend/messages ./messages
EXPOSE 3000
CMD ["npm", "start"]
