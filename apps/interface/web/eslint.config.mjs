import nextEslintPluginNext from '@next/eslint-plugin-next';
import nx from '@nx/eslint-plugin';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import baseConfig from '../../../eslint.config.mjs';

export default [
  { plugins: { '@next/next': nextEslintPluginNext, 'react-hooks': reactHooksPlugin } },
  ...baseConfig,
  ...nx.configs['flat/react-typescript'],
  {
    ignores: ['.next/**/*', '**/out-tsc'],
  },
];
