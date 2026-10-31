import { describe, test, expect } from 'vitest';
import { loginSchema, registerSchema, fieldErrors, serverFieldErrors } from '../validation/authSchemas';

const validUser = {
    fullname: 'Aisha Khan', username: 'aisha_k', email: 'aisha@x.com',
    password: 'secret1', confpassword: 'secret1', gender: 'female',
};

const errorsOf = (schema, data) => fieldErrors(schema.safeParse(data).error);

describe('loginSchema', () => {
    test('accepts a valid email and password', () => {
        expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
    });

    test('reports each missing or invalid field', () => {
        expect(errorsOf(loginSchema, { email: 'nope' })).toEqual({
            email: 'Enter a valid email address',
            password: 'Password is required',
        });
    });
});

describe('registerSchema', () => {
    test('accepts a valid user', () => {
        expect(registerSchema.safeParse(validUser).success).toBe(true);
    });

    test('rejects mismatched passwords on the confirm field', () => {
        expect(errorsOf(registerSchema, { ...validUser, confpassword: 'other1' }))
            .toEqual({ confpassword: "Passwords don't match" });
    });

    test('shows the password mismatch together with other errors', () => {
        const errors = errorsOf(registerSchema, { ...validUser, username: 'a', confpassword: 'other1' });
        expect(errors.username).toMatch(/3–20 characters/);
        expect(errors.confpassword).toBe("Passwords don't match");
    });

    test('requires a gender and a short password is rejected', () => {
        const errors = errorsOf(registerSchema, { ...validUser, gender: undefined, password: '123', confpassword: '123' });
        expect(errors.gender).toBe('Please select a gender');
        expect(errors.password).toBe('Use at least 6 characters');
    });
});

describe('serverFieldErrors', () => {
    test('maps backend errors to fields, keeping the first message per field', () => {
        expect(serverFieldErrors({ errors: [
            { field: 'email', message: 'Taken' },
            { field: 'email', message: 'Second' },
            { field: '', message: 'ignored' },
        ] })).toEqual({ email: 'Taken' });
    });

    test('handles a missing response body', () => {
        expect(serverFieldErrors(undefined)).toEqual({});
    });
});
