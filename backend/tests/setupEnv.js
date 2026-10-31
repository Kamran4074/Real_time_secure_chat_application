// Runs before every test file, before the app is imported
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
// high limits so normal tests never hit the rate limiters (rateLimit.test.js lowers them)
for(const name of ['AUTH_RATE_LIMIT', 'API_RATE_LIMIT', 'MESSAGE_RATE_LIMIT', 'SEARCH_RATE_LIMIT', 'SOCKET_EVENT_LIMIT']){
    process.env[name] ??= '100000';
}
