# Single-stage. Run TS source directly via tsx — handles the @/* and
# @shared/* path aliases that the project's tsconfig declares, which `tsc`
# emits literally and Node cannot resolve.
FROM node:22-alpine
WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY shared /app/shared
COPY backend/tsconfig.json ./
COPY backend/src ./src
ENV NODE_ENV=production
EXPOSE 4000
CMD ["npx", "tsx", "src/server.ts"]
