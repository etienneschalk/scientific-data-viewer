module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint'],
    rules: {
        // Base ESLint rules
        semi: 'warn',
        curly: 'warn',
        eqeqeq: 'warn',
        'no-throw-literal': 'warn',

        // TypeScript-specific rules
        '@typescript-eslint/no-unused-vars': 'warn',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-var-requires': 'error',
    },
    ignorePatterns: [
        'out',
        'dist',
        '**/*.d.ts',
        'node_modules',
        '.vscode-test',
    ],
};
