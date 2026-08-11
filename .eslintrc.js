/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: null,
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  ignorePatterns: ["node_modules/", "dist/", "build/", "coverage/"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
  },
  overrides: [
    {
      files: ["apps/api/src/locations/**/*.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["*/pricing/domain/*", "*/pricing/infrastructure/*"],
                message:
                  "Module boundary violation (Constitution Principle V): locations must not import pricing domain or infrastructure layers. Use PricingService (application layer) via synchronous call only.",
              },
              {
                group: ["*/iam/domain/*", "*/iam/infrastructure/*", "*/rentals/domain/*", "*/rentals/infrastructure/*"],
                message:
                  "Module boundary violation (Constitution Principle V): locations must not import another module's domain or infrastructure layer.",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["apps/api/src/pricing/**/*.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["*/locations/domain/*", "*/locations/infrastructure/*", "*/iam/domain/*", "*/iam/infrastructure/*", "*/rentals/domain/*", "*/rentals/infrastructure/*"],
                message:
                  "Module boundary violation (Constitution Principle V): pricing must not import another module's domain or infrastructure layer.",
              },
            ],
          },
        ],
      },
    },
  ],
};
