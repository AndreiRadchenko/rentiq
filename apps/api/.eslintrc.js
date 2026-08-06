module.exports = {
  extends: "../../.eslintrc.js",
  parserOptions: {
    project: "./tsconfig.json",
  },
  plugins: ["import"],
  settings: {
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true,
        project: "./tsconfig.json",
      },
    },
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "import/no-restricted-paths": [
      "error",
      {
        zones: [
          {
            target: "./src/organizations",
            from: ["./src/iam/domain", "./src/iam/infrastructure", "./src/iam/interface"],
            message:
              "T059 module boundary: organizations may import only iam's public application-service interface (application layer / iam.module), never iam domain/infrastructure/interface.",
          },
        ],
      },
    ],
  },
};
