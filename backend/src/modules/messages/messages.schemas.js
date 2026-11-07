import { z } from 'zod';
import { objectId } from '../../shared/validation.js';

export const MAX_MESSAGE_LENGTH = 2000;
const MESSAGE_PAGE_SIZE = 30;

export const sendMessageSchema = z.object({
    messages: z.string({ error: "Message can't be empty" })
        .trim()
        .min(1, "Message can't be empty")
        .max(MAX_MESSAGE_LENGTH, `Message must be under ${MAX_MESSAGE_LENGTH} characters`),
});

// one page of a chat: the newest messages, or those older than `before` (a message id)
export const messagesQuery = z.object({
    before: objectId("Invalid cursor").optional(),
    limit: z.coerce.number().int().min(1).max(50).default(MESSAGE_PAGE_SIZE),
});
