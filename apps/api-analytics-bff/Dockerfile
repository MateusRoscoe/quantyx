# Build the docker image with `npx nx docker:build api-analytics-bff`.
#
# Run the container with `npx nx docker:run api-analytics-bff -p 3004:3004`.
#
FROM docker.io/node:24-alpine


RUN corepack enable

WORKDIR /app

COPY dist .

# Strip workspace devDependencies — compiled libs are already in dist/libs/
RUN node -e "const p=require('./package.json');delete p.devDependencies;require('fs').writeFileSync('package.json',JSON.stringify(p))"

RUN pnpm install --prod

CMD [ "node", "--require", "./libs/otel/src/lib/register.js", "main.js" ]
