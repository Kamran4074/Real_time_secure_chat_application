import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../app.js';
import { startDb, stopDb } from './helpers.js';

beforeAll(startDb);
afterAll(stopDb);

describe('GET /api/health', ()=>{
    test('returns 200 when the database is up', async()=>{
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({status:'ok', db:'up'});
    });

    test('sets security headers (helmet)', async()=>{
        const res = await request(app).get('/api/health');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers).not.toHaveProperty('x-powered-by');
    });

    test('returns 503 when the database is down', async()=>{
        await mongoose.disconnect();
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(503);
        expect(res.body).toMatchObject({status:'error', db:'down'});
    });
});
