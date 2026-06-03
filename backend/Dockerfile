FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json prisma ./
RUN npm ci --omit=dev && npx prisma generate

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
EXPOSE 4000
CMD ["node", "src/server.js"]
