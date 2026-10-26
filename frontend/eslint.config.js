// @ts-check
// Flat config of ESLint 9. Formatting belongs to Prettier, so its conflicting rules are turned off last.
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const prettier = require('eslint-config-prettier');

module.exports = tseslint.config(
    { ignores: ['dist/**', 'node_modules/**', '.angular/**'] },
    {
        files: ['src/**/*.ts'],
        extends: [eslint.configs.recommended, ...tseslint.configs.recommended, ...angular.configs.tsRecommended, prettier],
        processor: angular.processInlineTemplates,
        rules: {
            '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
            '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }]
        }
    },
    {
        files: ['src/**/*.html'],
        extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility]
    }
);
