// Root ESLint configuration for Sentient Engine
// Individual workspaces may have their own configs that extend or override this

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
      'archive/**',
      'volumes/**',
      'hardware/**',
      'bin/**',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    rules: {
      // Basic rules that apply across all workspaces
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': 'off', // TypeScript handles this
    },
  },
];
