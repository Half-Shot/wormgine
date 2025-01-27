/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  testEnvironment: "node",
  transform: {
    "^.+.ts$": ["ts-jest",{}],
  },
  rootDir: "spec",
  "moduleNameMapper": {
    '^[@./a-zA-Z0-9$_-]+\\.(png|gif)$': '<rootDir>/test-utils/filemock.ts',
  },
  globalSetup: "./unit/setup.ts"
};