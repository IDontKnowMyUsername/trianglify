import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // tsconfig.json covers src/ (tests excluded); tsconfig.test.json
        // covers the test files, so type-aware rules run on both
        project: ['./tsconfig.json', './tsconfig.test.json'],
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      // noUncheckedIndexedAccess makes every indexed read T | undefined; a
      // `!` right after a structural guarantee (bounds-checked loops,
      // just-pushed entries) is this codebase's sanctioned narrowing idiom,
      // so the strict preset's blanket ban would force artificial
      // restructuring without catching anything real
      '@typescript-eslint/no-non-null-assertion': 'off',
      // numbers interpolate deterministically — the strict default only
      // allows strings, which would litter geometry messages with String()
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // typescript-eslint's eslint-recommended overlay disables these two —
      // re-enable them, they still catch real problems in TS code
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
    // build scripts are plain ESM JavaScript with no tsconfig — lint them
    // with the non-type-aware recommended rules (postbuild.mjs generates
    // shipped declarations, so it deserves lint coverage)
    files: ['scripts/**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly', URL: 'readonly' }
    }
  },
  {
    // tests require() built JS bundles, so everything they touch is `any` —
    // the unsafe-* family would flag every assertion
    files: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // assertions interpolate any-typed bundle values constantly
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off'
    }
  },
  {
    ignores: ['dist/**', '**/vendor/**', 'coverage/**', 'rollup.config.js']
  }
)
