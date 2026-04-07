# Build the docker image with `npx nx docker:build scheduler-analytics`.
#
# Run the container with `npx nx docker:run scheduler-analytics`.
#
FROM docker.io/node:24-alpine AS build

RUN corepack enable

WORKDIR /app

COPY dist .

# Strip workspace devDependencies before install
RUN node -e "\
const p=require('./package.json');\
delete p.devDependencies;\
require('fs').writeFileSync('package.json',JSON.stringify(p))"

RUN pnpm install --prod

FROM docker.io/node:24-alpine

WORKDIR /app

COPY --from=build /app .

CMD [ "node", "--import", "@quantyx/otel/register", "main.js" ]
