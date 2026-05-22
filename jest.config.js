module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'models/**/*.js',
    'middleware/**/*.js',
    'routes/**/*.js',
    'services/**/*.js',
    '!**/node_modules/**'
  ],
  testTimeout: 30000
};
