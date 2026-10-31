export default {
    testEnvironment: 'node',
    roots: ['<rootDir>'],
    testMatch: ['<rootDir>/tests/**/*.test.js'],
    setupFiles: ['<rootDir>/tests/setupEnv.js'],
    transform: {}, // native ES modules, no Babel
    silent: true, // hide controller console.log noise; run with --silent=false to debug
    testTimeout: 30000, // first run downloads a MongoDB binary
};
