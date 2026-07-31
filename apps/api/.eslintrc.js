module.exports = {
  extends: "../../.eslintrc.js",
  parserOptions: {
    project: "./apps/api/tsconfig.json",
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
  },
};
