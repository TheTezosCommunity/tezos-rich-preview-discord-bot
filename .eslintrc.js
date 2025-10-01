module.exports = {
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        project: "./tsconfig.json",
    },
    plugins: ["@typescript-eslint"],
    extends: [
        "eslint:recommended",
        "@typescript-eslint/recommended",
        "@typescript-eslint/recommended-requiring-type-checking",
    ],
    rules: {
        "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
        "@typescript-eslint/explicit-function-return-type": "warn",
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/prefer-const": "error",
        "no-console": "warn",
    },
    env: {
        node: true,
        es2022: true,
    },
};
