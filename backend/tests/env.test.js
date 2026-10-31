import { jest } from '@jest/globals';
import winston from 'winston';
import { loadEnv } from '../config/env.js';
import logger from '../utils/logger.js';

const ORIGINAL_ENV = { ...process.env };
const BASE = { MONGODB_CONNECT: 'mongodb://localhost:27017/chatapp', JWT_SECRET: 'x'.repeat(40) };

let exitSpy;
let logged;
let capture;

beforeEach(()=>{
    process.env = { ...BASE };
    // make process.exit throw instead of killing jest
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((code)=>{ throw new Error(`exit ${code}`); });
    logged = [];
    // collect log lines so we can check what loadEnv reported
    capture = new (class extends winston.Transport {
        log(info, done){ logged.push(info); done(); }
    })();
    logger.add(capture);
});

afterEach(()=>{
    process.env = { ...ORIGINAL_ENV };
    exitSpy.mockRestore();
    logger.remove(capture);
});

const failsWith = (env, pattern)=>{
    Object.assign(process.env, env);
    expect(()=> loadEnv()).toThrow('exit 1');
    expect(logged.map(l => l.message).join('\n')).toMatch(pattern);
};

describe('loadEnv (Zod)', ()=>{
    test('valid env: blank PORT falls back to 3000, numbers are coerced', ()=>{
        Object.assign(process.env, { PORT: '' });
        expect(loadEnv().PORT).toBe(3000);
        process.env.PORT = '4000';
        expect(loadEnv().PORT).toBe(4000);
    });

    test('missing MONGODB_CONNECT stops the server', ()=>{
        delete process.env.MONGODB_CONNECT;
        failsWith({}, /MONGODB_CONNECT is required/);
    });

    test('a non-mongodb url is rejected', ()=>{
        failsWith({ MONGODB_CONNECT: 'postgres://db' }, /mongodb:\/\//);
    });

    test('missing JWT_SECRET stops the server', ()=>{
        failsWith({ JWT_SECRET: '' }, /JWT_SECRET is required/);
    });

    test('SERVER_URL must be a full url', ()=>{
        failsWith({ SERVER_URL: 'chatwave.onrender.com' }, /SERVER_URL must be a full URL/);
    });

    test('OAuth id without secret is a mistake', ()=>{
        failsWith({ GOOGLE_CLIENT_ID: 'abc' }, /GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together/);
    });

    test('short JWT_SECRET only warns', ()=>{
        process.env.JWT_SECRET = 'short';
        expect(loadEnv().JWT_SECRET).toBe('short');
        expect(logged.some(l => l.level === 'warn' && /JWT_SECRET is short/.test(l.message))).toBe(true);
    });
});
