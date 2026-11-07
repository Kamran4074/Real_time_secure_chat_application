import { z } from 'zod';

// Reusable form-validation pieces (the same patterns the backend uses)
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const USERNAME = /^[a-zA-Z0-9_.]{3,20}$/;

export const required = (label) => z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`);
