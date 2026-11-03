import { z } from 'zod';
import { EMAIL, USERNAME, USERNAME_RULE, PASSWORD_RULE, required, newPassword } from '../../shared/validation.js';

const ALL_FIELDS = "All fields are required";
const LOGIN_REQUIRED = "Email and password are required";
const HEX_64 = /^[a-f0-9]{64}$/;

export const registerSchema = z.object({
    fullname: required(ALL_FIELDS).pipe(z.string().max(60, "Full name must be under 60 characters")),
    username: required(ALL_FIELDS).pipe(z.string().regex(USERNAME, USERNAME_RULE)),
    email: required(ALL_FIELDS).pipe(z.string().max(254, "Invalid email").regex(EMAIL, "Invalid email")),
    gender: required(ALL_FIELDS).pipe(z.enum(['male', 'female', 'other'], { error: "Invalid gender" })),
    password: z.string({ error: ALL_FIELDS }).min(1, ALL_FIELDS).min(6, PASSWORD_RULE).max(72, PASSWORD_RULE),
});

export const loginSchema = z.object({
    email: required(LOGIN_REQUIRED).pipe(z.string().max(254, "Invalid email or password")),
    password: z.string({ error: LOGIN_REQUIRED }).min(1, LOGIN_REQUIRED).max(200, "Invalid email or password"),
});

export const forgotPasswordSchema = z.object({
    email: required("Email is required").pipe(z.string().max(254, "Invalid email").regex(EMAIL, "Invalid email")),
});

export const resetPasswordSchema = z.object({
    token: z.string({ error: "Invalid reset link" }).regex(HEX_64, "Invalid reset link"),
    password: newPassword(),
});

// currentPassword is optional: Google / GitHub accounts have none yet and use this to set one
export const changePasswordSchema = z.object({
    currentPassword: z.string({ error: "Invalid password" }).max(200, "Current password is incorrect").optional(),
    newPassword: newPassword(),
});

export const oauthExchangeSchema = z.object({
    code: z.string({ error: "Invalid sign-in code" }).regex(HEX_64, "Invalid sign-in code"),
});
