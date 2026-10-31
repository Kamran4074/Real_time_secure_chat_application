import request from 'supertest';
import { app } from '../app.js';
import { startDb, stopDb, clearDb, registerUser, auth } from './helpers.js';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

describe('Zod validation responses', ()=>{
    test('return the first problem as message and every problem in errors[]', async()=>{
        const res = await request(app).post('/api/auth/register')
            .send({fullname:'Aisha', username:'a b', email:'nope', gender:'robot', password:'1'});

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Username/);
        expect(res.body.errors.map(e => e.field)).toEqual(['username', 'email', 'gender', 'password']);
    });

    test('trims input before it reaches the database', async()=>{
        const res = await request(app).post('/api/auth/register').send({
            fullname:'  Aisha Khan  ', username:'aisha', email:'  aisha@test.com ', gender:'female', password:'secret123'
        });
        expect(res.status).toBe(201);
        expect(res.body.fullname).toBe('Aisha Khan');
        expect(res.body.email).toBe('aisha@test.com');
    });

    test('drops unknown fields', async()=>{
        const res = await request(app).post('/api/auth/register').send({
            fullname:'Aisha', username:'aisha2', email:'a2@test.com', gender:'female', password:'secret123', isAdmin:true
        });
        expect(res.status).toBe(201);
        expect(res.body).not.toHaveProperty('isAdmin');
    });

    test('rejects a search sent as an array (?search=a&search=b)', async()=>{
        const user = await registerUser(app);
        const res = await request(app).get('/api/user/search?search=a&search=b').set(auth(user.token));
        expect(res.status).toBe(400);
    });
});

describe('error handling', ()=>{
    test('invalid JSON body -> 400', async()=>{
        const res = await request(app).post('/api/auth/login')
            .set('Content-Type', 'application/json').send('{"email": ');
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Invalid JSON body');
    });

    test('body over 10kb -> 413', async()=>{
        const res = await request(app).post('/api/auth/login')
            .send({email:'a@test.com', password:'x'.repeat(11 * 1024)});
        expect(res.status).toBe(413);
    });

    test('unknown route -> JSON 404', async()=>{
        const res = await request(app).get('/api/does-not-exist');
        expect(res.status).toBe(404);
        expect(res.body).toEqual({success:false, message:'Route not found'});
    });

    test('blocked CORS origin -> 403 instead of 500', async()=>{
        const res = await request(app).get('/api/health').set('Origin', 'https://evil.example');
        expect(res.status).toBe(403);
        expect(res.body.message).toBe('Origin not allowed');
    });

    test('allowed origin gets CORS headers', async()=>{
        const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
        expect(res.status).toBe(200);
        expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });
});

describe('request id', ()=>{
    test('every response gets an X-Request-Id', async()=>{
        const a = await request(app).get('/api/health');
        const b = await request(app).get('/api/health');
        expect(a.headers['x-request-id']).toMatch(/^[\w-]{36}$/);
        expect(a.headers['x-request-id']).not.toBe(b.headers['x-request-id']);
    });

    test('a safe incoming X-Request-Id is reused, an unsafe one is replaced', async()=>{
        const ok = await request(app).get('/api/health').set('X-Request-Id', 'trace-123');
        expect(ok.headers['x-request-id']).toBe('trace-123');

        const bad = await request(app).get('/api/health').set('X-Request-Id', '<script>alert(1)</script>');
        expect(bad.headers['x-request-id']).not.toContain('<');
    });
});
