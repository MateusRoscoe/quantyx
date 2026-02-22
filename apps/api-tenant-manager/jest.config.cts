/* eslint-disable */
const { readFileSync } = require('fs');

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(
  readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8')
);

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

module.exports = {
  displayName: 'api-tenant-manager',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
  globalSetup: `${__dirname}/jest.globalSetup.ts`,
  globalTeardown: `${__dirname}/jest.globalTeardown.ts`,
  testTimeout: 60000,
  forceExit: true,
  moduleNameMapper: {
    // Prisma 7 generated code uses dynamic import() of .mjs files; remap to CJS .js equivalents
    '^(@prisma/client/runtime/.+)\\.mjs$': '$1.js',
    // Resolve local .js imports from generated Prisma TS files to allow TS resolution
    '^(\\.{1,2}/.+)\\.js$': '$1',
  },
};
