import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: ['data/**/*.json', 'public/report/**']
  },
  {
    // The replay engine, its scripts and the build config are CommonJS on purpose:
    // the engine runs under plain `node` with no bundler or transpile step.
    files: ['engine/**/*.js', 'scripts/**/*.js', 'tailwind.config.ts', '*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  }
];

export default config;
