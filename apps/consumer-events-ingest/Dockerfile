# Build the docker image with `npx nx docker:build consumer-events-ingest`.
#
# Run the container with `npx nx docker:run consumer-events-ingest`.
#
FROM docker.io/node:lts-alpine

RUN corepack enable

WORKDIR /app

COPY dist .

# You can remove this install step if you build with `--bundle` option.
# The bundled output will include external dependencies.
RUN pnpm install

CMD [ "node", "main.js" ]
