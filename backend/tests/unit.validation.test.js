import { jest } from '@jest/globals';
import validate from '../middleware/validate.js';
import {
    registerSchema, loginSchema, oauthExchangeSchema, userIdParams, searchQuery, sendMessageSchema, MAX_MESSAGE_LENGTH
} from '../validation/schemas.js';

// Unit tests: Zod schemas and the validate() middleware with fake req/res objects

const firstError = (schema, data)=> schema.safeParse(data).error?.issues[0].message;

const validUser = { fullname: 'Aisha Khan', username: 'aisha_k', email: 'aisha@x.com', gender: 'female', password: 'secret1' };

describe('registerSchema', ()=>{
    test('accepts a valid user and trims text fields', ()=>{
        const result = registerSchema.parse({ ...validUser, fullname: '  Aisha Khan  ' });
        expect(result.fullname).toBe('Aisha Khan');
    });

    test('rejects missing fields', ()=>{
        expect(firstError(registerSchema, { ...validUser, email: '' })).toBe('All fields are required');
    });

    test.each([
        ['username', 'ab', /Username must be 3-20/],
        ['username', 'bad name!', /Username must be 3-20/],
        ['email', 'not-an-email', /Invalid email/],
        ['gender', 'robot', /Invalid gender/],
        ['password', '123', /Password must be 6-72/],
        ['password', 'x'.repeat(73), /Password must be 6-72/],
    ])('rejects invalid %s (%s)', (field, value, message)=>{
        expect(firstError(registerSchema, { ...validUser, [field]: value })).toMatch(message);
    });

    test('rejects NoSQL-injection objects instead of strings', ()=>{
        expect(registerSchema.safeParse({ ...validUser, email: {$ne: null} }).success).toBe(false);
    });
});

describe('other schemas', ()=>{
    test('loginSchema requires email and password', ()=>{
        expect(loginSchema.safeParse({email: 'a@b.com', password: 'x'}).success).toBe(true);
        expect(firstError(loginSchema, {email: 'a@b.com'})).toBe('Email and password are required');
    });

    test('oauthExchangeSchema accepts only a 64-char hex code', ()=>{
        expect(oauthExchangeSchema.safeParse({code: 'a'.repeat(64)}).success).toBe(true);
        expect(oauthExchangeSchema.safeParse({code: 'z'.repeat(64)}).success).toBe(false);
    });

    test('userIdParams accepts only a Mongo ObjectId', ()=>{
        expect(userIdParams.safeParse({id: '507f1f77bcf86cd799439011'}).success).toBe(true);
        expect(firstError(userIdParams, {id: 'xyz'})).toBe('Invalid user id');
    });

    test('searchQuery defaults to an empty string and limits length', ()=>{
        expect(searchQuery.parse({})).toEqual({search: ''});
        expect(firstError(searchQuery, {search: 'a'.repeat(51)})).toBe('Search is too long');
    });

    test('sendMessageSchema trims and enforces the length limit', ()=>{
        expect(sendMessageSchema.parse({messages: '  hi  '}).messages).toBe('hi');
        expect(firstError(sendMessageSchema, {messages: '   '})).toBe("Message can't be empty");
        expect(sendMessageSchema.safeParse({messages: 'x'.repeat(MAX_MESSAGE_LENGTH + 1)}).success).toBe(false);
    });
});

describe('validate middleware', ()=>{
    const fakeRes = ()=>{
        const res = {};
        res.status = jest.fn(()=> res);
        res.send = jest.fn(()=> res);
        return res;
    };

    test('calls next() and stores cleaned data on success', ()=>{
        const req = { body: {messages: '  hello  '} };
        const next = jest.fn();

        validate({body: sendMessageSchema})(req, fakeRes(), next);

        expect(next).toHaveBeenCalled();
        expect(req.valid.body.messages).toBe('hello');
        expect(req.body.messages).toBe('hello');
    });

    test('responds 400 with field errors and does not call next()', ()=>{
        const res = fakeRes();
        const next = jest.fn();

        validate({params: userIdParams})({ params: {id: 'bad'} }, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith({
            success: false,
            message: 'Invalid user id',
            errors: [{field: 'id', message: 'Invalid user id'}]
        });
    });

    test('treats a missing request part as an empty object', ()=>{
        const req = {};
        const next = jest.fn();
        validate({query: searchQuery})(req, fakeRes(), next);
        expect(req.valid.query).toEqual({search: ''});
        expect(next).toHaveBeenCalled();
    });
});
