//@ts-check

const path = require('path');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {},
  output: 'standalone',
  // Set tracing root to workspace root so hoisted node_modules
  // are captured inside .next/standalone/
  outputFileTracingRoot: path.join(__dirname, '../../../'),
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
