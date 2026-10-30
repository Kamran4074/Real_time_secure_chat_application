import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

let mongo;

// Throwaway in-memory MongoDB, so tests never touch the real database
export const startDb = async()=>{
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await mongoose.connection.syncIndexes(); // unique / TTL indexes
};

export const stopDb = async()=>{
    await mongoose.disconnect();
    await mongo?.stop();
};

export const clearDb = async()=>{
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map(c => c.deleteMany({})));
};

let counter = 0;

// Registers a user and returns the API response body (includes _id and token)
export const registerUser = async(app, overrides = {})=>{
    counter++;
    const body = {
        fullname: `Test User ${counter}`,
        username: `user${counter}`,
        email: `user${counter}@test.com`,
        gender: 'male',
        password: 'secret123',
        ...overrides
    };
    const res = await request(app).post('/api/auth/register').send(body);
    if(res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body;
};

export const auth = (token)=> ({ Authorization: `Bearer ${token}` });
