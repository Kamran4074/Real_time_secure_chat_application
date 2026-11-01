import request from 'supertest';
import { io as ioClient } from 'socket.io-client';
import { app, server } from '../app.js';
import { io } from '../socket/socket.js';
import Message from '../models/messageModel.js';
import Conversation from '../models/conversationModel.js';
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

const send = (from, to, text = 'hi')=>
    request(app).post(`/api/message/send/${to._id}`).set(auth(from.token)).send({messages:text});
const page = (user, other, query = {})=>
    request(app).get(`/api/message/${other._id}`).query(query).set(auth(user.token));
const seen = (user, other)=> request(app).post(`/api/message/seen/${other._id}`).set(auth(user.token));

const connect = (user)=> new Promise((resolve, reject)=>{
    const socket = ioClient(url, {auth:{token:user.token}, reconnection:false, forceNew:true});
    clients.push(socket);
    socket.on('connect', ()=> resolve(socket));
    socket.on('connect_error', reject);
});
const waitFor = (socket, event, ms = 2000)=> new Promise((resolve, reject)=>{
    const timer = setTimeout(()=> reject(new Error(`timed out waiting for ${event}`)), ms);
    socket.once(event, (data)=>{ clearTimeout(timer); resolve(data); });
});
const sleep = (ms)=> new Promise(resolve => setTimeout(resolve, ms));

let aisha, bilal;
beforeEach(async()=>{
    aisha = await registerUser(app, {username:'aisha'});
    bilal = await registerUser(app, {username:'bilal'});
});

describe('message pagination', ()=>{
    // 75 messages, created in order (insertMany keeps _id order)
    const seed = async()=>{
        await send(aisha, bilal, 'm0');
        const conversation = await Conversation.findOne();
        await Message.insertMany(Array.from({length:74}, (_, i)=>({
            senderId:aisha._id, recieverId:bilal._id, message:`m${i + 1}`, conversationId:conversation._id
        })));
    };

    test('first page is the newest 30, oldest first', async()=>{
        await seed();
        const res = await page(bilal, aisha);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(30);
        expect(res.body[0].message).toBe('m45');
        expect(res.body.at(-1).message).toBe('m74');
    });

    test('?before walks back page by page; the last page is short', async()=>{
        await seed();
        const first = (await page(bilal, aisha)).body;
        const second = (await page(bilal, aisha, {before:first[0]._id})).body;
        expect(second.map(m => m.message)).toEqual(Array.from({length:30}, (_, i)=> `m${i + 15}`));
        const third = (await page(bilal, aisha, {before:second[0]._id})).body;
        expect(third).toHaveLength(15);
        expect(third[0].message).toBe('m0');
    });

    test('limit can be lowered, but not above 50', async()=>{
        await seed();
        expect((await page(bilal, aisha, {limit:5})).body).toHaveLength(5);
        expect((await page(bilal, aisha, {limit:51})).status).toBe(400);
        expect((await page(bilal, aisha, {before:'nope'})).status).toBe(400);
    });

    test('sending no longer grows the conversation document, but still moves it to the top', async()=>{
        await send(aisha, bilal, 'one');
        const before = await Conversation.findOne();
        await sleep(20);
        await send(aisha, bilal, 'two');
        const after = await Conversation.findOne();
        expect(after.messages).toHaveLength(0);
        expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
    });
});

describe('read receipts', ()=>{
    test('a message to an offline user is sent (not delivered, not seen)', async()=>{
        const res = await send(aisha, bilal);
        expect(res.body).toMatchObject({deliveredAt:null, seenAt:null});
    });

    test('a message to an online user is delivered right away', async()=>{
        await connect(bilal);
        const res = await send(aisha, bilal);
        expect(res.body.deliveredAt).toEqual(expect.any(String));
    });

    test('when the receiver connects, waiting messages become delivered and the sender is told', async()=>{
        const aishaSocket = await connect(aisha);
        await send(aisha, bilal, 'while you were away');
        const delivered = waitFor(aishaSocket, 'messagesDelivered');
        await connect(bilal);
        expect(await delivered).toMatchObject({receiverId:bilal._id, at:expect.any(String)});
        expect((await Message.findOne()).deliveredAt).toBeInstanceOf(Date);
    });

    test('opening the chat marks it seen and tells the sender live', async()=>{
        const aishaSocket = await connect(aisha);
        await send(aisha, bilal, 'one');
        await send(aisha, bilal, 'two');

        const event = waitFor(aishaSocket, 'messagesSeen');
        const res = await seen(bilal, aisha);
        expect(res.body.seen).toBe(2);
        expect(await event).toMatchObject({receiverId:bilal._id});

        const stored = await Message.find();
        expect(stored.every(m => m.seenAt && m.deliveredAt)).toBe(true);
    });

    test('marking seen again changes nothing and sends no event', async()=>{
        await send(aisha, bilal);
        await seen(bilal, aisha);
        expect((await seen(bilal, aisha)).body.seen).toBe(0);
    });

    test('you can only mark messages sent TO you as seen', async()=>{
        await send(aisha, bilal);
        expect((await seen(aisha, bilal)).body.seen).toBe(0); // the sender can't "see" their own message for bilal
        expect((await Message.findOne()).seenAt).toBeNull();
    });

    test('requires login and a valid id', async()=>{
        expect((await request(app).post(`/api/message/seen/${aisha._id}`)).status).toBe(401);
        expect((await seen(bilal, {_id:'nope'})).status).toBe(400);
    });
});

describe('last seen', ()=>{
    test('is saved when the last tab closes, and shown to others', async()=>{
        const socket = await connect(bilal);
        await send(aisha, bilal);
        const before = Date.now();
        socket.close();
        await sleep(300); // past the (test) offline grace period

        const stored = await User.findById(bilal._id);
        expect(stored.lastSeen.getTime()).toBeGreaterThanOrEqual(before - 50);
        const chats = await request(app).get('/api/user/currentchatters').set(auth(aisha.token));
        expect(chats.body[0].lastSeen).toEqual(stored.lastSeen.toISOString());
    });

    test('others online are told the exact time, but not across a block', async()=>{
        const carol = await registerUser(app, {username:'carol'});
        const aishaSocket = await connect(aisha);
        const carolSocket = await connect(carol);
        const bilalSocket = await connect(bilal);
        await request(app).post(`/api/user/block/${bilal._id}`).set(auth(carol.token));

        const told = waitFor(aishaSocket, 'lastSeen');
        let carolTold = false;
        carolSocket.on('lastSeen', ()=>{ carolTold = true; });
        const left = Date.now();
        bilalSocket.close();

        const event = await told;
        expect(event.userId).toBe(bilal._id);
        expect(Math.abs(new Date(event.at).getTime() - left)).toBeLessThan(200); // when he left, not after the grace period
        await sleep(100);
        expect(carolTold).toBe(false);
    });

    test('is hidden in recent chats between blocked users', async()=>{
        await send(aisha, bilal);
        await User.updateOne({_id:bilal._id}, {lastSeen:new Date()});
        await request(app).post(`/api/user/block/${aisha._id}`).set(auth(bilal.token));
        const chats = await request(app).get('/api/user/currentchatters').set(auth(aisha.token));
        expect(chats.body[0].username).toBe('bilal');
        expect(chats.body[0]).not.toHaveProperty('lastSeen');
    });
});
