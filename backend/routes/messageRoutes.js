import express from 'express';
import { getMessages, sendMessage, markSeen } from '../controllers/messageController.js';
import isLogin from '../middleware/isLogin.js';
import validate from '../middleware/validate.js';
import { messageLimiter } from '../middleware/rateLimiters.js';
import { userIdParams, sendMessageSchema, messagesQuery } from '../validation/schemas.js';

const router = express.Router();

router.post('/send/:id',isLogin,messageLimiter,validate({params:userIdParams, body:sendMessageSchema}),sendMessage);
router.post('/seen/:id',isLogin,validate({params:userIdParams}),markSeen);
router.get('/:id',isLogin,validate({params:userIdParams, query:messagesQuery}),getMessages);

export default router;
