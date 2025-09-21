import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { globalIgnores } from 'eslint/config';

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Utility files and non-React files
    files: ['src/utils/**/*.ts', 'src/api/**/*.ts', 'src/types/**/*.ts'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Third-party library integration files
    files: [
      'src/components/PhotoLightbox.tsx',
      'src/components/MapPicker.tsx',
      'src/components/LocationInput.tsx',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // Allow any for third-party library integration
    },
  },
]);
