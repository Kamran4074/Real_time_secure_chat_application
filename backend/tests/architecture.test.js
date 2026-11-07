import request from 'supertest';
import winston from 'winston';
import { app } from '../src/server.js';
import logger from '../src/shared/logger.js';
import { startDb, stopDb, clearDb, registerUser, auth } from './helpers.js';

// The debugging guarantees from docs/ARCHITECTURE.md ("Errors: always know where it broke")

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

// collects every log entry (after formatting) while a test runs
let logs;
const capture = new (class extends winston.Transport {
    log(info, done){ logs.push(info); done(); }
})();
beforeEach(()=>{ logs = []; logger.add(capture); });
afterEach(()=> logger.remove(capture));

describe('error codes', ()=>{
    test('an expected failure answers with a stable <MODULE>_<REASON> code', async()=>{
        const me = await registerUser(app);
        const res = await request(app).post(`/api/message/send/${me._id}`).set(auth(me.token)).send({messages: 'hi'});
        expect(res.status).toBe(400);
        expect(res.body).toEqual({success: false, code: 'MESSAGES_CANNOT_MESSAGE_SELF', message: "You can't message yourself"});
    });

    test('field errors keep the {field, message} list', async()=>{
        await registerUser(app, {username: 'taken'});
        const me = await registerUser(app);
        const res = await request(app).patch('/api/user/me').set(auth(me.token)).send({username: 'TAKEN'});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('USERS_USERNAME_TAKEN');
        expect(res.body.errors).toEqual([{field: 'username', message: 'Username already taken'}]);
    });
});

describe('log context', ()=>{
    test('service log lines carry the requestId and module of the request', async()=>{
        await registerUser(app);
        await request(app).post('/api/auth/login').set('X-Request-Id', 'trace-123')
            .send({email: 'nobody@test.com', password: 'wrong-password'});

        const failed = logs.find(entry => entry.message === 'Failed login attempt');
        expect(failed).toMatchObject({requestId: 'trace-123', module: 'auth'});

        const requestLine = logs.find(entry => entry.message.startsWith('POST /api/auth/login 400'));
        expect(requestLine).toMatchObject({requestId: 'trace-123', module: 'auth'});
    });
});
