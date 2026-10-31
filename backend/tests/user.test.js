import request from 'supertest';
import { app } from '../app.js';
import User from '../models/userModel.js';
import { startDb, stopDb, clearDb, registerUser, auth } from './helpers.js';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

const search = (user, q)=>
    request(app).get('/api/user/search').query({search:q}).set(auth(user.token));

describe('GET /api/user/search', ()=>{
    let me;
    beforeEach(async()=>{
        me = await registerUser(app, {username:'searcher', fullname:'Search Er'});
        await registerUser(app, {username:'johnny', fullname:'Johnny Bravo'});
        await registerUser(app, {username:'alice', fullname:'Alice Johnson'});
    });

    test('matches username or full name, case-insensitive', async()=>{
        const res = await search(me, 'JOHN');
        expect(res.status).toBe(200);
        expect(res.body.map(u => u.username).sort()).toEqual(['alice','johnny']);
    });

    test('never returns password or email', async()=>{
        const res = await search(me, 'john');
        for(const u of res.body){
            expect(u).not.toHaveProperty('password');
            expect(u).not.toHaveProperty('email');
        }
    });

    test('does not include the current user', async()=>{
        const res = await search(me, 'search');
        expect(res.body).toEqual([]);
    });

    test('empty search returns nothing instead of every user', async()=>{
        const res = await search(me, '   ');
        expect(res.body).toEqual([]);
    });

    test('regex characters are matched literally', async()=>{
        const res = await search(me, '.*');
        expect(res.body).toEqual([]);
    });

    test('rejects searches over 50 chars', async()=>{
        const res = await search(me, 'a'.repeat(51));
        expect(res.status).toBe(400);
    });

    test('returns at most 20 users', async()=>{
        await User.insertMany(Array.from({length:25}, (_, i)=>({
            fullname:`Bulk ${i}`, username:`bulk${i}`, email:`bulk${i}@test.com`,
            gender:'female', password:'x'.repeat(60), profilepic:'https://example.com/a.png'
        })));
        const res = await search(me, 'bulk');
        expect(res.body).toHaveLength(20);
    });

    test('requires login', async()=>{
        const res = await request(app).get('/api/user/search?search=john');
        expect(res.status).toBe(401);
    });
});

describe('GET /api/user/currentchatters', ()=>{
    const send = (from, to, text)=>
        request(app).post(`/api/message/send/${to._id}`).set(auth(from.token)).send({messages:text});
    const chatters = (user)=>
        request(app).get('/api/user/currentchatters').set(auth(user.token));

    test('returns [] for a new user', async()=>{
        const me = await registerUser(app);
        const res = await chatters(me);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('lists people you chatted with, most recent first', async()=>{
        const [me, bob, carol] = [await registerUser(app), await registerUser(app), await registerUser(app)];
        await send(me, bob, 'hi bob');
        await send(me, carol, 'hi carol');

        let res = await chatters(me);
        expect(res.body.map(u => u._id)).toEqual([carol._id, bob._id]);

        // bob replies -> moves to the top
        await send(bob, me, 'hey');
        res = await chatters(me);
        expect(res.body.map(u => u._id)).toEqual([bob._id, carol._id]);
    });

    test('works from the receiver side too and hides private fields', async()=>{
        const [me, bob] = [await registerUser(app), await registerUser(app)];
        await send(me, bob, 'hi');

        const res = await chatters(bob);
        expect(res.body).toHaveLength(1);
        expect(res.body[0]._id).toBe(me._id);
        expect(res.body[0]).not.toHaveProperty('password');
        expect(res.body[0]).not.toHaveProperty('email');
    });

    test('skips users that were deleted', async()=>{
        const [me, bob, carol] = [await registerUser(app), await registerUser(app), await registerUser(app)];
        await send(me, bob, 'hi');
        await send(me, carol, 'hi');
        await User.deleteOne({_id:bob._id});

        const res = await chatters(me);
        expect(res.status).toBe(200);
        expect(res.body.map(u => u._id)).toEqual([carol._id]);
    });
});
