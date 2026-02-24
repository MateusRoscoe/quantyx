# Build the docker image with `npx nx docker:build web`.
#
# Run the container with `npx nx docker:run web -p 3000:3000`.
#
FROM docker.io/node:lts-alpine

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# standalone output preserves the monorepo directory structure
# because outputFileTracingRoot is set to the workspace root.
# server.js ends up at .next/standalone/apps/interface/web/server.js
WORKDIR /app/apps/interface/web

# Copy standalone server (includes traced node_modules at /app/node_modules/)
COPY .next/standalone/ /app/

# Copy static assets (not included in standalone output)
COPY .next/static/ ./.next/static/

# Copy public folder
COPY public/ ./public/

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
