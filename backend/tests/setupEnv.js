// Runs before every test file, before the app is imported
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
// high limit so normal tests never hit the rate limiter (rateLimit.test.js lowers it)
process.env.AUTH_RATE_LIMIT ??= '1000';
