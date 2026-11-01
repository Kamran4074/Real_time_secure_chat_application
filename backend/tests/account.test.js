import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../app.js';
import User from '../models/userModel.js';
import PasswordReset from '../models/passwordResetModel.js';
import { startDb, stopDb, clearDb, registerUser, auth } from './helpers.js';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

const me = (token)=> request(app).get('/api/user/me').set(auth(token));
const changePassword = (token, body)=> request(app).post('/api/auth/change-password').set(auth(token)).send(body);
const login = (email, password)=> request(app).post('/api/auth/login').send({email, password});

// tokens carry iat in whole seconds: wait so "issued before" vs "after" is unambiguous
const nextSecond = ()=> new Promise(resolve => setTimeout(resolve, 1100));

describe('GET /api/user/me account info', ()=>{
    test('a normal account has a password and no linked providers', async()=>{
        const user = await registerUser(app);
        const res = await me(user.token);
        expect(res.body).toMatchObject({hasPassword:true, linkedAccounts:{google:false, github:false}});
    });

    test('a Google-only account has no password and Google linked', async()=>{
        const user = await User.create({fullname:'G User', username:'guser', email:'g@test.com', googleId:'g-1', profilepic:'x'});
        const token = jwt.sign({userId:user._id}, process.env.JWT_SECRET, {jwtid:'g-token'});
        const res = await me(token);
        expect(res.body).toMatchObject({hasPassword:false, linkedAccounts:{google:true, github:false}});
    });
});

describe('POST /api/auth/change-password', ()=>{
    test('changes the password, keeps this device logged in and ends other sessions', async()=>{
        const user = await registerUser(app);
        const otherDevice = (await login(user.email, 'secret123')).body.token;
        await nextSecond();

        const res = await changePassword(user.token, {currentPassword:'secret123', newPassword:'newsecret1'});
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Password changed');

        expect((await me(res.body.token)).status).toBe(200);       // new token works
        expect((await me(user.token)).status).toBe(401);           // this device's old token
        expect((await me(otherDevice)).status).toBe(401);          // other devices
        expect((await login(user.email, 'secret123')).status).toBe(400);
        expect((await login(user.email, 'newsecret1')).status).toBe(200);
    });

    test('wrong or missing current password is rejected on the field', async()=>{
        const user = await registerUser(app);
        for(const body of [{currentPassword:'wrong-one', newPassword:'newsecret1'}, {newPassword:'newsecret1'}]){
            const res = await changePassword(user.token, body);
            expect(res.status).toBe(400);
            expect(res.body.errors).toEqual([{field:'currentPassword', message:'Current password is incorrect'}]);
        }
        expect((await login(user.email, 'secret123')).status).toBe(200);
    });

    test('rejects a too-short new password', async()=>{
        const user = await registerUser(app);
        const res = await changePassword(user.token, {currentPassword:'secret123', newPassword:'123'});
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/6-72/);
    });

    test('Google / GitHub accounts can set a first password without a current one', async()=>{
        const user = await User.create({fullname:'G User', username:'guser', email:'g@test.com', googleId:'g-1', profilepic:'x'});
        const token = jwt.sign({userId:user._id}, process.env.JWT_SECRET, {jwtid:'g-token-2'});
        const res = await changePassword(token, {newPassword:'firstpass1'});
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Password set');
        expect((await login('g@test.com', 'firstpass1')).status).toBe(200);
    });

    test('pending reset links stop working', async()=>{
        const user = await registerUser(app);
        await request(app).post('/api/auth/forgot-password').send({email:user.email});
        expect(await PasswordReset.countDocuments()).toBe(1);
        await changePassword(user.token, {currentPassword:'secret123', newPassword:'newsecret1'});
        expect(await PasswordReset.countDocuments()).toBe(0);
    });

    test('requires login', async()=>{
        expect((await request(app).post('/api/auth/change-password').send({newPassword:'newsecret1'})).status).toBe(401);
    });
});

describe('POST /api/auth/logout-all', ()=>{
    test('ends every session, and logging in again works', async()=>{
        const user = await registerUser(app);
        const otherDevice = (await login(user.email, 'secret123')).body.token;
        await nextSecond();

        const res = await request(app).post('/api/auth/logout-all').set(auth(user.token));
        expect(res.status).toBe(200);
        expect((await me(user.token)).status).toBe(401);
        expect((await me(otherDevice)).status).toBe(401);

        await nextSecond();
        const fresh = (await login(user.email, 'secret123')).body.token;
        expect((await me(fresh)).status).toBe(200);
    });
});
