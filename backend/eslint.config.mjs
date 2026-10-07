import tseslint from 'typescript-eslint';
export default [{
 files: ['src/**/*.ts'],
 languageOptions: { parser: tseslint.parser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module' } },
 rules: { 'no-debugger':'error', 'no-dupe-args':'error', 'no-dupe-keys':'error', 'no-unreachable':'error', 'no-unsafe-finally':'error', 'no-constant-binary-expression':'error' }
}];
