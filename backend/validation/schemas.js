import { z } from 'zod';

// Every request input is described here. validate() runs these before the controller,
// so controllers only ever see clean, trimmed, correctly-typed data.

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME = /^[a-zA-Z0-9_.]{3,20}$/;
export const MAX_MESSAGE_LENGTH = 2000;

// a string that must be present (also rejects objects like {"$ne": null})
const required = (message)=> z.string({ error: message }).trim().min(1, message);

const ALL_FIELDS = "All fields are required";
const PASSWORD_RULE = "Password must be 6-72 characters";

//----------------------
// auth
//----------------------
export const registerSchema = z.object({
    fullname: required(ALL_FIELDS).pipe(z.string().max(60, "Full name must be under 60 characters")),
    username: required(ALL_FIELDS).pipe(z.string().regex(USERNAME, "Username must be 3-20 characters (letters, numbers, _ or .)")),
    email: required(ALL_FIELDS).pipe(z.string().max(254, "Invalid email").regex(EMAIL, "Invalid email")),
    gender: required(ALL_FIELDS).pipe(z.enum(['male', 'female', 'other'], { error: "Invalid gender" })),
    // not trimmed: spaces are allowed in passwords; 72 = bcrypt's limit
    password: z.string({ error: ALL_FIELDS }).min(1, ALL_FIELDS).min(6, PASSWORD_RULE).max(72, PASSWORD_RULE),
});

const LOGIN_REQUIRED = "Email and password are required";
export const loginSchema = z.object({
    email: required(LOGIN_REQUIRED).pipe(z.string().max(254, "Invalid email or password")),
    password: z.string({ error: LOGIN_REQUIRED }).min(1, LOGIN_REQUIRED).max(200, "Invalid email or password"),
});

export const forgotPasswordSchema = z.object({
    email: required("Email is required").pipe(z.string().max(254, "Invalid email").regex(EMAIL, "Invalid email")),
});

export const resetPasswordSchema = z.object({
    token: z.string({ error: "Invalid reset link" }).regex(/^[a-f0-9]{64}$/, "Invalid reset link"),
    password: z.string({ error: PASSWORD_RULE }).min(6, PASSWORD_RULE).max(72, PASSWORD_RULE),
});

// currentPassword is optional: Google / GitHub accounts have none yet and use this to set one
export const changePasswordSchema = z.object({
    currentPassword: z.string({ error: "Invalid password" }).max(200, "Current password is incorrect").optional(),
    newPassword: z.string({ error: PASSWORD_RULE }).min(6, PASSWORD_RULE).max(72, PASSWORD_RULE),
});

export const oauthExchangeSchema = z.object({
    code: z.string({ error: "Invalid sign-in code" }).regex(/^[a-f0-9]{64}$/, "Invalid sign-in code"),
});

//----------------------
// users & messages
//----------------------
export const userIdParams = z.object({
    id: z.string().regex(OBJECT_ID, "Invalid user id"),
});

const MESSAGE_PAGE_SIZE = 30;
// one page of a chat: the newest messages, or those older than `before` (a message id)
export const messagesQuery = z.object({
    before: z.string().regex(OBJECT_ID, "Invalid cursor").optional(),
    limit: z.coerce.number().int().min(1).max(50).default(MESSAGE_PAGE_SIZE),
});

export const searchQuery = z.object({
    search: z.string({ error: "Invalid search" }).trim().max(50, "Search is too long").optional().default(''),
});

// Partial update of your own profile. strictObject rejects any other key (password, email, googleId, ...)
const MAX_BIO_LENGTH = 140;
export const updateProfileSchema = z.strictObject({
    fullname: required("Name can't be empty").pipe(z.string().max(60, "Name must be under 60 characters")).optional(),
    username: required("Username can't be empty").pipe(z.string().regex(USERNAME, "Username must be 3-20 characters (letters, numbers, _ or .)")).optional(),
    bio: z.string({ error: "Invalid bio" }).trim().max(MAX_BIO_LENGTH, `Bio must be under ${MAX_BIO_LENGTH} characters`).optional(),
    // a URL from our own Cloudinary upload (checked in the controller), or null to remove the photo
    profilepic: z.string({ error: "Invalid photo" }).max(500, "Invalid photo").nullable().optional(),
}, { error: (issue)=> issue.code === 'unrecognized_keys' ? `Field can't be changed: ${issue.keys.join(', ')}` : undefined })
    .refine(data => Object.keys(data).length > 0, "Nothing to update");

export const sendMessageSchema = z.object({
    messages: z.string({ error: "Message can't be empty" })
        .trim()
        .min(1, "Message can't be empty")
        .max(MAX_MESSAGE_LENGTH, `Message must be under ${MAX_MESSAGE_LENGTH} characters`),
});

//----------------------
// socket events
//----------------------
export const typingEventSchema = z.object({
    receiverId: z.string().regex(OBJECT_ID),
});
