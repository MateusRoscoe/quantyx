# Build the docker image with `npx nx docker:build api-tenant-manager`.
#
# Run the container with `npx nx docker:run api-tenant-manager -p 3000:3000`.
#
FROM docker.io/node:24-alpine

ENV HOST=0.0.0.0
ENV PORT=3000

RUN corepack enable

WORKDIR /app

COPY dist .

# You can remove this install step if you build with `--bundle` option.
# The bundled output will include external dependencies.
RUN pnpm install

CMD [ "node", "main.js" ]
