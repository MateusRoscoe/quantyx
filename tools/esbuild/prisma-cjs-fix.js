// esbuild config: makes Prisma 7's generated client.ts safe in CJS output.
//
// Prisma 7 emits:
//   globalThis['__dirname'] = path.dirname(fileURLToPath(import.meta.url))
//
// In CJS, `import.meta` is empty so `import.meta.url` is undefined, crashing
// fileURLToPath. In CJS, `__dirname` is already available, so the whole line
// is unnecessary. This plugin guards it behind a typeof check.
const { readFileSync } = require('fs');

const prismaClientCjsFixPlugin = {
  name: 'prisma-client-cjs-fix',
  setup(build) {
    build.onLoad({ filter: /generated[\\/]client\.ts$/ }, async (args) => {
      const contents = readFileSync(args.path, 'utf8');
      return {
        contents: contents.replace(
          "globalThis['__dirname'] = path.dirname(fileURLToPath(import.meta.url))",
          "if (typeof __dirname === 'undefined') { globalThis['__dirname'] = path.dirname(fileURLToPath(import.meta.url)); }",
        ),
        loader: 'ts',
      };
    });
  },
};

module.exports = {
  outExtension: { '.js': '.js' },
  plugins: [prismaClientCjsFixPlugin],
};
