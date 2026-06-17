# Multi-stage build for the Nexus Sentinel API. Build context is the repo root:
#   docker build -f apps/api/Dockerfile -t nexus-sentinel-api .
FROM node:22-slim AS build
WORKDIR /repo
RUN corepack enable

# Install against the lockfile with only the files that affect resolution.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile

# Build the shared contracts and the API, then produce a pruned prod bundle.
COPY packages/contracts ./packages/contracts
COPY apps/api ./apps/api
RUN pnpm --filter @nexus/contracts build \
  && pnpm --filter @nexus/api build \
  && pnpm --filter @nexus/api deploy --prod /out

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/dist ./dist
COPY --from=build /out/package.json ./package.json
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
