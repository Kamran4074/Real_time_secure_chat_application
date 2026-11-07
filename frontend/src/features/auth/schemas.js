import { z } from 'zod';
import { EMAIL, USERNAME, required } from '../../shared/lib/validation';

// Same rules as the backend (backend/src/modules/auth/auth.schemas.js), so users see
// problems next to the field before anything is sent.

export const loginSchema = z.object({
    email: required('Email').pipe(z.string().regex(EMAIL, 'Enter a valid email address')),
    password: z.string({ error: 'Password is required' }).min(1, 'Password is required'),
});

export const registerSchema = z.object({
    fullname: required('Full name').pipe(z.string().max(60, 'Keep it under 60 characters')),
    username: required('Username').pipe(z.string().regex(USERNAME, '3–20 characters: letters, numbers, _ or .')),
    email: required('Email').pipe(z.string().regex(EMAIL, 'Enter a valid email address')),
    password: z.string({ error: 'Password is required' })
        .min(6, 'Use at least 6 characters')
        .max(72, 'Use at most 72 characters'),
    confpassword: z.string({ error: 'Please confirm your password' }).min(1, 'Please confirm your password'),
    gender: z.enum(['male', 'female', 'other'], { error: 'Please select a gender' }),
}).refine(data => data.password === data.confpassword, {
    path: ['confpassword'],
    message: "Passwords don't match",
    // run even when other fields have errors, so every problem shows at once
    when: ({ value }) => typeof value?.password === 'string' && typeof value?.confpassword === 'string' && value.confpassword !== '',
});

export const forgotPasswordSchema = z.object({
    email: required('Email').pipe(z.string().regex(EMAIL, 'Enter a valid email address')),
});

export const resetPasswordSchema = z.object({
    password: z.string({ error: 'Password is required' })
        .min(6, 'Use at least 6 characters')
        .max(72, 'Use at most 72 characters'),
    confpassword: z.string({ error: 'Please confirm your password' }).min(1, 'Please confirm your password'),
}).refine(data => data.password === data.confpassword, {
    path: ['confpassword'],
    message: "Passwords don't match",
});

// Change password while logged in; current password only for accounts that have one
export const changePasswordSchema = (hasPassword) => z.object({
    currentPassword: hasPassword
        ? z.string().min(1, 'Enter your current password')
        : z.string().optional(),
    newPassword: z.string({ error: 'Password is required' })
        .min(6, 'Use at least 6 characters')
        .max(72, 'Use at most 72 characters'),
    confpassword: z.string().min(1, 'Please confirm your password'),
}).refine(data => data.newPassword === data.confpassword, {
    path: ['confpassword'],
    message: "Passwords don't match",
});

// the token in the emailed link: 64 hex characters
export const isResetToken = (token) => /^[a-f0-9]{64}$/.test(token || '');
