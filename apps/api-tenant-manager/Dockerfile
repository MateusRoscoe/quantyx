# Build the docker image with `npx nx docker:build api-tenant-manager`.
#
# Run the container with `npx nx docker:run api-tenant-manager -p 3000:3000`.
#
FROM docker.io/node:24-alpine


RUN corepack enable

WORKDIR /app

COPY dist .

# Strip workspace devDependencies — compiled libs are already in dist/libs/
RUN node -e "const p=require('./package.json');delete p.devDependencies;require('fs').writeFileSync('package.json',JSON.stringify(p))"

RUN pnpm install --prod

CMD [ "node", "--import", "@quantyx/otel/register", "main.js" ]
