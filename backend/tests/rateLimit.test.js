import request from 'supertest';
import { startDb, stopDb } from './helpers.js';

// lower the limit before the app is loaded (setupEnv sets 1000 for other suites)
process.env.AUTH_RATE_LIMIT = '3';
const { app } = await import('../app.js');

beforeAll(startDb);
afterAll(stopDb);

describe('auth rate limiting', ()=>{
    test('blocks login after too many attempts with 429', async()=>{
        const attempt = ()=> request(app).post('/api/auth/login').send({email:'x@test.com', password:'wrong'});

        for(let i = 0; i < 3; i++){
            expect((await attempt()).status).toBe(400);
        }
        const blocked = await attempt();
        expect(blocked.status).toBe(429);
        expect(blocked.body.message).toMatch(/Too many attempts/);
    });

    test('does not limit normal API routes', async()=>{
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
    });
});
