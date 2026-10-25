FROM node:24-bookworm-slim AS base

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS build

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma7.config.ts ./
COPY prisma ./prisma
# Prisma reads the URL while generating, but does not connect during this step.
RUN DATABASE_URL=postgresql://build@localhost:5432/build npx prisma generate

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM base AS runtime

ENV NODE_ENV=production \
    PORT=3000

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma7.config.ts ./prisma7.config.ts
COPY --from=build /app/prisma ./prisma

EXPOSE 3000

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node dist/server.js"]
