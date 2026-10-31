import request from 'supertest';
import { app } from '../app.js';
import User from '../models/userModel.js';
import { startDb, stopDb, clearDb, registerUser, auth } from './helpers.js';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

const CLOUDINARY = {
    CLOUDINARY_CLOUD_NAME: 'demo-cloud',
    CLOUDINARY_API_KEY: '123456',
    CLOUDINARY_API_SECRET: 'cloud-secret'
};
const withCloudinary = ()=> Object.assign(process.env, CLOUDINARY);
const withoutCloudinary = ()=> Object.keys(CLOUDINARY).forEach(key => delete process.env[key]);
afterEach(withoutCloudinary);

const getMe = (user)=> request(app).get('/api/user/me').set(auth(user.token));
const patchMe = (user, body)=> request(app).patch('/api/user/me').set(auth(user.token)).send(body);
const photoUrl = (userId, cloud = 'demo-cloud')=>
    `https://res.cloudinary.com/${cloud}/image/upload/v1712345678/chatwave/avatars/${userId}.webp`;

describe('GET /api/user/me', ()=>{
    test('returns your own profile with email but no secrets', async()=>{
        const me = await registerUser(app, {username:'aisha', email:'aisha@test.com'});
        const res = await getMe(me);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({_id:me._id, username:'aisha', email:'aisha@test.com', bio:'', canUploadPhoto:false});
        expect(res.body).not.toHaveProperty('password');
    });

    test('canUploadPhoto is true when Cloudinary is configured', async()=>{
        withCloudinary();
        const me = await registerUser(app);
        expect((await getMe(me)).body.canUploadPhoto).toBe(true);
    });

    test('requires login', async()=>{
        expect((await request(app).get('/api/user/me')).status).toBe(401);
    });
});

describe('PATCH /api/user/me', ()=>{
    let me;
    beforeEach(async()=>{ me = await registerUser(app, {username:'aisha', fullname:'Aisha Khan'}); });

    test('updates name, username and bio (trimmed)', async()=>{
        const res = await patchMe(me, {fullname:'  Aisha K  ', username:'aisha_k', bio:'  Hey there!  '});
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({fullname:'Aisha K', username:'aisha_k', bio:'Hey there!'});
        const saved = await User.findById(me._id);
        expect(saved).toMatchObject({fullname:'Aisha K', username:'aisha_k', bio:'Hey there!'});
    });

    test('password still works after a profile update', async()=>{
        await patchMe(me, {bio:'new bio'});
        const login = await request(app).post('/api/auth/login').send({email:me.email, password:'secret123'});
        expect(login.status).toBe(200);
    });

    test('rejects a username someone else has (case-insensitive)', async()=>{
        await registerUser(app, {username:'Bilal'});
        const res = await patchMe(me, {username:'bilal'});
        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual([{field:'username', message:'Username already taken'}]);
    });

    test('allows changing the case of your own username', async()=>{
        const res = await patchMe(me, {username:'Aisha'});
        expect(res.status).toBe(200);
        expect(res.body.username).toBe('Aisha');
    });

    test.each([
        [{username:'a b'}, /Username must be 3-20/],
        [{fullname:'   '}, /Name can't be empty/],
        [{bio:'x'.repeat(141)}, /Bio must be under 140/],
        [{}, /Nothing to update/],
    ])('rejects invalid input %j', async(body, message)=>{
        const res = await patchMe(me, body);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(message);
    });

    test('mass assignment: email, password and other fields can not be changed here', async()=>{
        const res = await patchMe(me, {bio:'hi', email:'evil@test.com', password:'hacked123', googleId:'1'});
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/can't be changed/);
        const saved = await User.findById(me._id);
        expect(saved.email).toBe(me.email);
        expect(saved.bio).toBe('');
    });

    test('rejects NoSQL operators instead of strings', async()=>{
        const res = await patchMe(me, {username:{$ne:null}});
        expect(res.status).toBe(400);
    });

    describe('profile photo', ()=>{
        beforeEach(withCloudinary);

        test('accepts your own Cloudinary upload', async()=>{
            const res = await patchMe(me, {profilepic:photoUrl(me._id)});
            expect(res.status).toBe(200);
            expect(res.body.profilepic).toBe(photoUrl(me._id));
        });

        test.each([
            ['another site', 'https://evil.com/pixel.png'],
            ['another cloud', null],
            ['another user\'s photo', 'other-user'],
            ['a path trick', 'path-trick'],
            ['a non-WebP file', 'jpg'],
        ])('rejects %s', async(_, kind)=>{
            const url = kind === null ? photoUrl(me._id, 'other-cloud')
                : kind === 'other-user' ? photoUrl('507f1f77bcf86cd799439011')
                : kind === 'path-trick' ? `${photoUrl(me._id)}/../../x.webp`
                : kind === 'jpg' ? photoUrl(me._id).replace('.webp', '.jpg')
                : kind;
            const res = await patchMe(me, {profilepic:url});
            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Invalid photo');
        });

        test('null removes the photo and restores the generated avatar', async()=>{
            await patchMe(me, {profilepic:photoUrl(me._id)});
            const res = await patchMe(me, {profilepic:null});
            expect(res.status).toBe(200);
            expect(res.body.profilepic).toMatch(/avatar\.iran\.liara\.run.*username=aisha/);
        });
    });

    test('other users see the new bio but never your email', async()=>{
        const other = await registerUser(app);
        await patchMe(me, {bio:'Available'});
        const res = await request(app).get('/api/user/search').query({search:'aisha'}).set(auth(other.token));
        expect(res.body[0]).toMatchObject({username:'aisha', bio:'Available'});
        expect(Object.keys(res.body[0]).sort()).toEqual(['_id', 'bio', 'fullname', 'profilepic', 'username']);
    });
});

describe('POST /api/user/me/avatar-signature', ()=>{
    const signature = (user)=> request(app).post('/api/user/me/avatar-signature').set(auth(user.token));

    test('503 when Cloudinary is not configured', async()=>{
        const me = await registerUser(app);
        expect((await signature(me)).status).toBe(503);
    });

    test('signs an upload locked to your own file name, folder and formats', async()=>{
        withCloudinary();
        const me = await registerUser(app);
        const res = await signature(me);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            uploadUrl:'https://api.cloudinary.com/v1_1/demo-cloud/image/upload',
            apiKey:'123456',
            folder:'chatwave/avatars',
            public_id:me._id,
            allowed_formats:'jpg,jpeg,png,webp',
            transformation:'c_fill,g_face,w_400,h_400,q_auto,f_webp',
            overwrite:'true'
        });
        expect(res.body.signature).toMatch(/^[a-f0-9]{40}$/);
        expect(JSON.stringify(res.body)).not.toContain('cloud-secret');
    });

    test('requires login', async()=>{
        expect((await request(app).post('/api/user/me/avatar-signature')).status).toBe(401);
    });
});
