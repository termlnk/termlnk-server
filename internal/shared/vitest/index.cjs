const { defineConfig, mergeConfig } = require('vitest/config');

/**
 * Default vitest config for termlnk-server packages. Node environment, no DOM.
 * Caller passes a partial config that gets merged on top.
 */
function createConfig(options) {
  return defineConfig(mergeConfig({
    test: {
      testTimeout: 0,
      environment: 'node',
      passWithNoTests: true,
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
      ],
      coverage: {
        reporter: ['html', 'json'],
        exclude: [
          'coverage/**',
          'dist/**',
          '**/[.]**',
          '**/*.d.ts',
          '**/__test?(s)__/**',
          '**/*{.,-}{test,spec}?(-d).?(c|m)[jt]s',
          '**/{rollup,webpack,vite,vitest,jest,build}.config.*',
          'lib/**',
        ],
      },
    },
  }, options));
}

module.exports = createConfig;
