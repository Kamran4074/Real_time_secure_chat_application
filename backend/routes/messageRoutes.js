import express from 'express';
import { getMessages, sendMessage } from '../controllers/messageController.js';
import isLogin from '../middleware/isLogin.js';
import validate from '../middleware/validate.js';
import { messageLimiter } from '../middleware/rateLimiters.js';
import { userIdParams, sendMessageSchema } from '../validation/schemas.js';

const router = express.Router();

router.post('/send/:id',isLogin,messageLimiter,validate({params:userIdParams, body:sendMessageSchema}),sendMessage);
router.get('/:id',isLogin,validate({params:userIdParams}),getMessages);

export default router;
