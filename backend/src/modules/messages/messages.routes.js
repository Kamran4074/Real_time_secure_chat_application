import express from 'express';
import { requireAuth } from '../auth/index.js';
import validate from '../../shared/middleware/validate.js';
import { apiLimiter, messageLimiter } from '../../shared/middleware/rateLimiters.js';
import { userIdParams } from '../../shared/validation.js';
import { sendMessageSchema, messagesQuery } from './messages.schemas.js';
import * as controller from './messages.controller.js';

export const basePath = '/message';
export const router = express.Router();

// overall cap per IP, shared by every module (stricter limits are added per route below)
router.use(apiLimiter);

router.use(requireAuth);

// recent chats (the sidebar), most recent first
router.get('/conversations', controller.getRecentChats);
router.post('/send/:id', messageLimiter, validate({params: userIdParams, body: sendMessageSchema}), controller.sendMessage);
router.post('/seen/:id', validate({params: userIdParams}), controller.markSeen);
router.get('/:id', validate({params: userIdParams, query: messagesQuery}), controller.getMessages);
