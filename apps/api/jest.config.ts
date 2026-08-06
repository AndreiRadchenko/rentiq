/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "..",
  testRegex: ".*\\.(spec|test)\\.ts$",
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
  collectCoverageFrom: ["src/**/*.(t|j)s"],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
};
