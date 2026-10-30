import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../app.js';
import { startDb, stopDb, clearDb, registerUser, auth } from './helpers.js';

beforeAll(startDb);
afterAll(stopDb);

let alice, bob;
beforeEach(async()=>{
    await clearDb();
    alice = await registerUser(app);
    bob = await registerUser(app);
});

const send = (from, toId, messages)=>
    request(app).post(`/api/message/send/${toId}`).set(auth(from.token)).send({messages});

describe('POST /api/message/send/:id', ()=>{
    test('sends a message and stores it', async()=>{
        const res = await send(alice, bob._id, '  hello bob  ');

        expect(res.status).toBe(201);
        expect(res.body.message).toBe('hello bob'); // trimmed
        expect(res.body.senderId).toBe(alice._id);
        expect(res.body.recieverId).toBe(bob._id);
        expect(res.body.conversationId).toEqual(expect.any(String));
    });

    test('requires login', async()=>{
        const res = await request(app).post(`/api/message/send/${bob._id}`).send({messages:'hi'});
        expect(res.status).toBe(401);
    });

    test.each([
        ['invalid receiver id', ()=>'not-an-id', 'hi', 400],
        ['messaging yourself', ()=>alice._id, 'hi', 400],
        ['empty message', ()=>bob._id, '', 400],
        ['whitespace-only message', ()=>bob._id, '    ', 400],
        ['non-string message', ()=>bob._id, {$gt:''}, 400],
        ['message over 2000 chars', ()=>bob._id, 'a'.repeat(2001), 400],
        ['receiver that does not exist', ()=>new mongoose.Types.ObjectId().toString(), 'hi', 404],
    ])('rejects %s', async(_, receiver, message, status)=>{
        const res = await send(alice, receiver(), message);
        expect(res.status).toBe(status);
        expect(res.body.success).toBe(false);
    });

    test('accepts exactly 2000 chars', async()=>{
        const res = await send(alice, bob._id, 'a'.repeat(2000));
        expect(res.status).toBe(201);
    });

    test('reuses one conversation for both directions', async()=>{
        const a = await send(alice, bob._id, 'hi bob');
        const b = await send(bob, alice._id, 'hi alice');
        expect(a.body.conversationId).toBe(b.body.conversationId);
    });
});

describe('GET /api/message/:id', ()=>{
    test('returns the conversation in order for both participants', async()=>{
        await send(alice, bob._id, 'one');
        await send(bob, alice._id, 'two');
        await send(alice, bob._id, 'three');

        const forAlice = await request(app).get(`/api/message/${bob._id}`).set(auth(alice.token));
        const forBob = await request(app).get(`/api/message/${alice._id}`).set(auth(bob.token));

        expect(forAlice.status).toBe(200);
        expect(forAlice.body.map(m => m.message)).toEqual(['one','two','three']);
        expect(forBob.body.map(m => m.message)).toEqual(['one','two','three']);
    });

    test('returns [] when there is no conversation yet', async()=>{
        const res = await request(app).get(`/api/message/${bob._id}`).set(auth(alice.token));
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('a third user cannot read alice and bob\'s chat', async()=>{
        const eve = await registerUser(app);
        await send(alice, bob._id, 'secret');

        // eve can only ask for her own conversation with bob, which is empty
        const res = await request(app).get(`/api/message/${bob._id}`).set(auth(eve.token));
        expect(res.body).toEqual([]);
    });

    test('rejects an invalid id', async()=>{
        const res = await request(app).get('/api/message/xyz').set(auth(alice.token));
        expect(res.status).toBe(400);
    });
});
