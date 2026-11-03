import { z } from 'zod';
import { USERNAME, USERNAME_RULE, required } from '../../shared/validation.js';

export const searchQuery = z.object({
    search: z.string({ error: "Invalid search" }).trim().max(50, "Search is too long").optional().default(''),
});

// Partial update of your own profile. strictObject rejects any other key (password, email, googleId, ...)
const MAX_BIO_LENGTH = 140;
export const updateProfileSchema = z.strictObject({
    fullname: required("Name can't be empty").pipe(z.string().max(60, "Name must be under 60 characters")).optional(),
    username: required("Username can't be empty").pipe(z.string().regex(USERNAME, USERNAME_RULE)).optional(),
    bio: z.string({ error: "Invalid bio" }).trim().max(MAX_BIO_LENGTH, `Bio must be under ${MAX_BIO_LENGTH} characters`).optional(),
    // a URL from our own Cloudinary upload (checked in the service), or null to remove the photo
    profilepic: z.string({ error: "Invalid photo" }).max(500, "Invalid photo").nullable().optional(),
}, { error: (issue)=> issue.code === 'unrecognized_keys' ? `Field can't be changed: ${issue.keys.join(', ')}` : undefined })
    .refine(data => Object.keys(data).length > 0, "Nothing to update");
