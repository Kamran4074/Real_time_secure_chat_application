import { z } from 'zod';

// Reusable zod pieces. Each module describes its own inputs in <module>.schemas.js;
// validate() runs them before the controller, so controllers only see clean, trimmed, typed data.

const OBJECT_ID = /^[a-f0-9]{24}$/i;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const USERNAME = /^[a-zA-Z0-9_.]{3,20}$/;
export const USERNAME_RULE = "Username must be 3-20 characters (letters, numbers, _ or .)";
export const PASSWORD_RULE = "Password must be 6-72 characters";

// a string that must be present (also rejects objects like {"$ne": null})
export const required = (message)=> z.string({ error: message }).trim().min(1, message);

// not trimmed: spaces are allowed in passwords; 72 = bcrypt's limit
export const newPassword = (message = PASSWORD_RULE)=> z.string({ error: message }).min(6, PASSWORD_RULE).max(72, PASSWORD_RULE);

export const objectId = (message)=> z.string().regex(OBJECT_ID, message);

// /:id of another user (users and messages routes)
export const userIdParams = z.object({
    id: objectId("Invalid user id"),
});
