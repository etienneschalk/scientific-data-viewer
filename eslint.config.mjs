import tseslint from 'typescript-eslint';

export default [
    {
        ignores: ['out', 'dist', '**/*.d.ts', 'node_modules', '.vscode-test'],
    },
    {
        files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
        languageOptions: {
            parser: tseslint.parser,
            sourceType: 'module',
        },
        plugins: { '@typescript-eslint': tseslint.plugin },
        // As eslint 8: a directive for a rule that is off is not reported
        linterOptions: { reportUnusedDisableDirectives: 'off' },
        rules: {
            // Base ESLint rules
            semi: 'warn',
            curly: 'warn',
            eqeqeq: 'warn',
            'no-throw-literal': 'warn',

            // TypeScript-specific rules
            // caughtErrors: 'none' was the default of typescript-eslint 5
            '@typescript-eslint/no-unused-vars': ['warn', { caughtErrors: 'none' }],
            // XXX any is used in some places to avoid type errors, we should fix them instead.
            '@typescript-eslint/no-explicit-any': 'off',
            // Replaces no-var-requires (deprecated in typescript-eslint 8)
            '@typescript-eslint/no-require-imports': 'error',
        },
    },
];
