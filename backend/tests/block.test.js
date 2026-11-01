import request from 'supertest';
import { io as ioClient } from 'socket.io-client';
import { app, server } from '../app.js';
import { io } from '../socket/socket.js';
import User from '../models/userModel.js';
import { startDb, stopDb, clearDb, registerUser, auth } from './helpers.js';

let url;
const clients = [];

beforeAll(async()=>{
    await startDb();
    await new Promise(resolve => server.listen(0, resolve));
    url = `http://localhost:${server.address().port}`;
});
afterAll(async()=>{
    io.close();
    await stopDb();
});
afterEach(()=> clients.splice(0).forEach(c => c.close()));
beforeEach(clearDb);

const block = (from, to)=> request(app).post(`/api/user/block/${to._id}`).set(auth(from.token));
const unblock = (from, to)=> request(app).delete(`/api/user/block/${to._id}`).set(auth(from.token));
const send = (from, to, text = 'hi')=>
    request(app).post(`/api/message/send/${to._id}`).set(auth(from.token)).send({messages:text});
const search = (user, q)=> request(app).get('/api/user/search').query({search:q}).set(auth(user.token));

// every online list a socket receives is recorded from the start, so none is missed
const connect = (user)=> new Promise((resolve, reject)=>{
    const socket = ioClient(url, {auth:{token:user.token}, reconnection:false, forceNew:true});
    socket.lists = [];
    socket.on('getOnlineUsers', ids => socket.lists.push(ids));
    clients.push(socket);
    socket.on('connect', ()=> resolve(socket));
    socket.on('connect_error', reject);
});
const waitFor = (socket, event, ms = 2000)=> new Promise((resolve, reject)=>{
    const timer = setTimeout(()=> reject(new Error(`timed out waiting for ${event}`)), ms);
    socket.once(event, (data)=>{ clearTimeout(timer); resolve(data); });
});
const notReceived = (socket, event, ms = 300)=> new Promise(resolve=>{
    const timer = setTimeout(()=> resolve(true), ms);
    socket.once(event, ()=>{ clearTimeout(timer); resolve(false); });
});
// waits until the latest online list the socket got satisfies check
const latestList = async(socket, check)=>{
    for(let waited = 0; waited < 2000; waited += 20){
        const latest = socket.lists.at(-1);
        if(latest && check(latest)) return latest;
        await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error(`online list never matched, got ${JSON.stringify(socket.lists.at(-1))}`);
};

let aisha, bilal;
beforeEach(async()=>{
    aisha = await registerUser(app, {username:'aisha', fullname:'Aisha Khan'});
    bilal = await registerUser(app, {username:'bilal', fullname:'Bilal Ahmed'});
});

describe('block / unblock API', ()=>{
    test('block adds the user to your blocked list, unblock removes it', async()=>{
        expect((await block(aisha, bilal)).status).toBe(200);
        let list = await request(app).get('/api/user/blocked').set(auth(aisha.token));
        expect(list.body.map(u => u.username)).toEqual(['bilal']);
        expect(list.body[0]).not.toHaveProperty('email');

        expect((await unblock(aisha, bilal)).status).toBe(200);
        list = await request(app).get('/api/user/blocked').set(auth(aisha.token));
        expect(list.body).toEqual([]);
    });

    test('blocking twice stores the user once', async()=>{
        await block(aisha, bilal);
        await block(aisha, bilal);
        expect((await User.findById(aisha._id)).blockedUsers).toHaveLength(1);
    });

    test('you can not block yourself', async()=>{
        expect((await block(aisha, aisha)).status).toBe(400);
    });

    test('404 for a user that does not exist, 400 for a bad id', async()=>{
        expect((await block(aisha, {_id:'507f1f77bcf86cd799439011'})).status).toBe(404);
        expect((await block(aisha, {_id:'nope'})).status).toBe(400);
    });

    test('requires login', async()=>{
        expect((await request(app).post(`/api/user/block/${bilal._id}`)).status).toBe(401);
    });
});

describe('effects of a block', ()=>{
    test('neither side can send messages; unblocking allows it again', async()=>{
        await block(aisha, bilal);
        const mine = await send(aisha, bilal);
        expect(mine.status).toBe(403);
        expect(mine.body.message).toBe('Unblock this user to send a message');

        const theirs = await send(bilal, aisha);
        expect(theirs.status).toBe(403);
        expect(theirs.body.message).toBe("You can't message this user");

        await unblock(aisha, bilal);
        expect((await send(bilal, aisha)).status).toBe(201);
    });

    test('a blocked user is not delivered a message in real time', async()=>{
        const aishaSocket = await connect(aisha);
        await block(aisha, bilal);
        await send(bilal, aisha);
        expect(await notReceived(aishaSocket, 'newMessage')).toBe(true);
    });

    test('people who blocked you do not show up in your search', async()=>{
        await block(aisha, bilal);
        expect((await search(bilal, 'aisha')).body).toEqual([]);
        // the blocker can still find them (e.g. to unblock)
        expect((await search(aisha, 'bilal')).body.map(u => u.username)).toEqual(['bilal']);
    });

    test('chat history stays readable after a block', async()=>{
        await send(aisha, bilal, 'before');
        await block(bilal, aisha);
        const res = await request(app).get(`/api/message/${aisha._id}`).set(auth(bilal.token));
        expect(res.body.map(m => m.message)).toEqual(['before']);
    });
});

describe('block over sockets', ()=>{
    test('online status is hidden both ways while blocked and comes back after unblock', async()=>{
        const aishaSocket = await connect(aisha);
        const bilalSocket = await connect(bilal);
        await latestList(aishaSocket, ids => ids.includes(bilal._id));

        await block(aisha, bilal);
        expect(await latestList(aishaSocket, ids => !ids.includes(bilal._id))).toContain(aisha._id);
        expect(await latestList(bilalSocket, ids => !ids.includes(aisha._id))).toContain(bilal._id);

        await unblock(aisha, bilal);
        await latestList(bilalSocket, ids => ids.includes(aisha._id));
    });

    test('a block made while offline applies when the user connects', async()=>{
        await block(aisha, bilal);
        const bilalSocket = await connect(bilal);
        const aishaSocket = await connect(aisha);
        await latestList(aishaSocket, ids => ids.includes(aisha._id));
        await new Promise(resolve => setTimeout(resolve, 100));
        // no list Bilal ever got contains Aisha
        expect(bilalSocket.lists.length).toBeGreaterThan(1);
        expect(bilalSocket.lists.flat()).not.toContain(aisha._id);
        expect(aishaSocket.lists.flat()).not.toContain(bilal._id);
    });

    test('typing events are not forwarded between blocked users', async()=>{
        const aishaSocket = await connect(aisha);
        const bilalSocket = await connect(bilal);
        await block(bilal, aisha);

        bilalSocket.emit('typing', {receiverId:aisha._id});
        expect(await notReceived(aishaSocket, 'userTyping')).toBe(true);
        aishaSocket.emit('typing', {receiverId:bilal._id});
        expect(await notReceived(bilalSocket, 'userTyping')).toBe(true);

        await unblock(bilal, aisha);
        const typing = waitFor(bilalSocket, 'userTyping');
        aishaSocket.emit('typing', {receiverId:bilal._id});
        expect(await typing).toEqual({senderId:aisha._id});
    });
});
