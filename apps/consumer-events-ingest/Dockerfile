# Build the docker image with `npx nx docker:build consumer-events-ingest`.
#
# Run the container with `npx nx docker:run consumer-events-ingest`.
#
FROM docker.io/node:24-alpine AS build

RUN apk add --no-cache python3 make g++
RUN corepack enable

WORKDIR /app

COPY dist .

# Strip workspace devDependencies and allow native builds
RUN node -e "\
const p=require('./package.json');\
delete p.devDependencies;\
p.pnpm={onlyBuiltDependencies:['@confluentinc/kafka-javascript']};\
require('fs').writeFileSync('package.json',JSON.stringify(p))"

RUN pnpm install --prod

FROM docker.io/node:24-alpine

WORKDIR /app

COPY --from=build /app .

CMD [ "node", "--require", "./libs/otel/src/lib/register.js", "main.js" ]
