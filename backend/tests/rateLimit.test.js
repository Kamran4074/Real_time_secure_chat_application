import request from 'supertest';
import { startDb, stopDb, auth } from './helpers.js';

// lower the limits before the app is loaded (setupEnv sets them high for other suites)
process.env.AUTH_RATE_LIMIT = '3';
process.env.MESSAGE_RATE_LIMIT = '2';
process.env.SEARCH_RATE_LIMIT = '2';
// dynamic imports: a static import would load the limiters before these lines run
const { app } = await import('../app.js');
const { socketEventLimiter } = await import('../middleware/rateLimiters.js');

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
        expect(blocked.headers['retry-after']).toBeDefined();
    });

    test('does not limit the health check', async()=>{
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.headers['ratelimit']).toBeUndefined();
    });
});

describe('per-user limits', ()=>{
    let alice, bob, carol;
    beforeAll(async()=>{
        alice = await registerFromOwnIp('alice', '10.0.0.1');
        bob = await registerFromOwnIp('bob', '10.0.0.2');
        carol = await registerFromOwnIp('carol', '10.0.0.3');
    });

    test('blocks sending messages too fast, per user', async()=>{
        const send = (from, to)=> request(app).post(`/api/message/send/${to._id}`).set(auth(from.token)).send({messages:'hi'});

        expect((await send(alice, bob)).status).toBe(201);
        expect((await send(alice, bob)).status).toBe(201);
        const blocked = await send(alice, bob);
        expect(blocked.status).toBe(429);
        expect(blocked.body.message).toMatch(/too fast/);

        // another user from the same IP is not affected
        expect((await send(carol, bob)).status).toBe(201);
    });

    test('blocks searching too often', async()=>{
        const search = ()=> request(app).get('/api/user/search?search=b').set(auth(bob.token));
        expect((await search()).status).toBe(200);
        expect((await search()).status).toBe(200);
        expect((await search()).status).toBe(429);
    });
});

describe('socket event limiter', ()=>{
    test('allows `limit` events per window, then drops the rest until the window resets', ()=>{
        let now = 1000;
        const realNow = Date.now;
        Date.now = ()=> now;
        try {
            const allow = socketEventLimiter({limit: 3, windowMs: 5000});
            expect([allow(), allow(), allow(), allow()]).toEqual([true, true, true, false]);
            now += 5000;
            expect(allow()).toBe(true);
        } finally {
            Date.now = realNow;
        }
    });
});

// the auth limiter above is used up for 127.0.0.1, so each user registers from its own IP
// (trust proxy is on, so X-Forwarded-For sets req.ip)
async function registerFromOwnIp(name, ip){
    const res = await request(app).post('/api/auth/register')
        .set('X-Forwarded-For', ip)
        .send({fullname: name, username: name, email: `${name}@rate.test`, gender: 'male', password: 'secret123'});
    if(res.status !== 201) throw new Error(`register failed: ${res.status}`);
    return res.body;
}
