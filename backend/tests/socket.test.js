import request from 'supertest';
import jwt from 'jsonwebtoken';
import { io as ioClient } from 'socket.io-client';
import { app, server } from '../app.js';
import { io } from '../socket/socket.js';
import { startDb, stopDb, clearDb, registerUser, auth } from './helpers.js';

let url;
const clients = [];

beforeAll(async()=>{
    await startDb();
    await new Promise(resolve => server.listen(0, resolve)); // random free port
    url = `http://localhost:${server.address().port}`;
});

afterAll(async()=>{
    io.close(); // also closes the http server
    await stopDb();
});

afterEach(()=>{
    clients.splice(0).forEach(c => c.close());
});

beforeEach(clearDb);

// Resolves with the connected socket, or with the error message if rejected
const connect = (token)=> new Promise(resolve=>{
    const socket = ioClient(url, {auth:{token}, reconnection:false, forceNew:true});
    clients.push(socket);
    socket.on('connect', ()=> resolve(socket));
    socket.on('connect_error', (err)=> resolve(err.message));
});

const waitFor = (socket, event, ms = 2000)=> new Promise((resolve, reject)=>{
    const timer = setTimeout(()=> reject(new Error(`timed out waiting for ${event}`)), ms);
    socket.once(event, (data)=>{ clearTimeout(timer); resolve(data); });
});

// Resolves true if the event does NOT arrive within ms
const notReceived = (socket, event, ms = 300)=> new Promise(resolve=>{
    const timer = setTimeout(()=> resolve(true), ms);
    socket.once(event, ()=>{ clearTimeout(timer); resolve(false); });
});

describe('socket authentication', ()=>{
    test('rejects a connection without a token', async()=>{
        expect(await connect(undefined)).toBe('Unauthorized');
    });

    test('rejects a forged token', async()=>{
        const forged = jwt.sign({userId:'507f1f77bcf86cd799439011'}, 'wrong-secret', {jwtid:'x'});
        expect(await connect(forged)).toBe('Unauthorized');
    });

    test('ignores a userId in the query (old hijack method)', async()=>{
        const victim = await registerUser(app);
        const attacker = ioClient(url, {query:{userId:victim._id}, reconnection:false, forceNew:true});
        clients.push(attacker);
        const result = await new Promise(resolve=>{
            attacker.on('connect', ()=> resolve('connected'));
            attacker.on('connect_error', (e)=> resolve(e.message));
        });
        expect(result).toBe('Unauthorized');
    });

    test('accepts a valid token and reports the user online', async()=>{
        const user = await registerUser(app);
        const socket = ioClient(url, {auth:{token:user.token}, reconnection:false, forceNew:true});
        clients.push(socket);
        const online = await waitFor(socket, 'getOnlineUsers');
        expect(online).toContain(user._id);
    });

    test('logout disconnects that socket and the token cannot reconnect', async()=>{
        const user = await registerUser(app);
        const socket = await connect(user.token);
        const dropped = waitFor(socket, 'disconnect');

        await request(app).post('/api/auth/logout').set(auth(user.token));

        expect(await dropped).toBe('io server disconnect');
        expect(await connect(user.token)).toBe('Unauthorized');
    });
});

describe('real-time messaging', ()=>{
    let alice, bob;
    beforeEach(async()=>{
        alice = await registerUser(app);
        bob = await registerUser(app);
    });

    test('delivers newMessage to every open tab of the receiver', async()=>{
        const bobTab1 = await connect(bob.token);
        const bobTab2 = await connect(bob.token);
        const got1 = waitFor(bobTab1, 'newMessage');
        const got2 = waitFor(bobTab2, 'newMessage');

        await request(app).post(`/api/message/send/${bob._id}`).set(auth(alice.token)).send({messages:'hello'});

        expect((await got1).message).toBe('hello');
        expect((await got2).message).toBe('hello');
    });

    test('a third user does not receive the message', async()=>{
        const eve = await registerUser(app);
        const eveSocket = await connect(eve.token);
        const missed = notReceived(eveSocket, 'newMessage');

        await request(app).post(`/api/message/send/${bob._id}`).set(auth(alice.token)).send({messages:'private'});

        expect(await missed).toBe(true);
    });

    test('forwards typing events with the real sender id', async()=>{
        const aliceSocket = await connect(alice.token);
        const bobSocket = await connect(bob.token);
        const typing = waitFor(bobSocket, 'userTyping');
        const stopped = waitFor(bobSocket, 'userStoppedTyping');

        aliceSocket.emit('typing', {receiverId:bob._id});
        aliceSocket.emit('stopTyping', {receiverId:bob._id});

        expect(await typing).toEqual({senderId:alice._id});
        expect(await stopped).toEqual({senderId:alice._id});
    });

    test('ignores typing events with an invalid receiver id', async()=>{
        const aliceSocket = await connect(alice.token);
        aliceSocket.emit('typing', {receiverId:{$ne:null}});
        aliceSocket.emit('typing');
        // server must stay up and keep this socket connected
        await new Promise(r => setTimeout(r, 100));
        expect(aliceSocket.connected).toBe(true);
    });

    test('user stays online until their last tab closes', async()=>{
        const watcher = await connect(alice.token);
        const tab1 = await connect(bob.token);
        const tab2 = await connect(bob.token);
        await new Promise(r => setTimeout(r, 200)); // let the "connected" broadcasts arrive first

        let update = waitFor(watcher, 'getOnlineUsers');
        tab1.close();
        expect(await update).toContain(bob._id);

        update = waitFor(watcher, 'getOnlineUsers');
        tab2.close();
        expect(await update).not.toContain(bob._id);
    });
});
