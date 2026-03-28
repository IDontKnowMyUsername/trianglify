import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        self: 'readonly',
        Worker: 'readonly'
      }
    },
    rules: {
      'no-var': 'error',
      'prefer-const': 'error',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-unused-expressions': ['error', {
        allowShortCircuit: true
      }]
    }
  },
  {
    files: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  {
    ignores: ['dist/**', '**/vendor/**', 'coverage/**', 'rollup.config.js']
  }
)
