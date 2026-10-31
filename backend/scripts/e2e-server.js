// Starts the real backend on a throwaway in-memory MongoDB for the Playwright tests
// (frontend/e2e). Nothing touches the real database. Usage: npm run e2e:server
import { MongoMemoryServer } from 'mongodb-memory-server';

const mongo = await MongoMemoryServer.create();

Object.assign(process.env, {
    NODE_ENV: 'test',
    PORT: process.env.PORT || '3100',
    MONGODB_CONNECT: mongo.getUri('chatwave-e2e'),
    JWT_SECRET: 'e2e-secret',
    CLIENT_ORIGINS: process.env.CLIENT_ORIGINS || 'http://localhost:4173',
    // empty = disabled, so OAuth keys from a local .env are not used
    GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '',
    GITHUB_CLIENT_ID: '', GITHUB_CLIENT_SECRET: '',
});

process.on('exit', ()=> mongo.stop());

await import('../index.js');
