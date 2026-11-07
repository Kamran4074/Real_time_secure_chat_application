import { z } from 'zod';
import { USERNAME, required } from '../../shared/lib/validation';

// Profile edit (same rules as backend/src/modules/users/users.schemas.js)
export const MAX_BIO_LENGTH = 140;
export const profileSchema = z.object({
    fullname: required('Name').pipe(z.string().max(60, 'Keep it under 60 characters')),
    username: required('Username').pipe(z.string().regex(USERNAME, '3–20 characters: letters, numbers, _ or .')),
    bio: z.string().trim().max(MAX_BIO_LENGTH, `Keep it under ${MAX_BIO_LENGTH} characters`),
});
