module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.test.js'],
    coverageDirectory: 'coverage',
    collectCoverage: false,
    setupFiles: ['./setupTests.js'],
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};