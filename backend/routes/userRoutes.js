import express from 'express';
import isLogin from '../middleware/isLogin.js'
import validate from '../middleware/validate.js';
import { searchLimiter } from '../middleware/rateLimiters.js';
import { searchQuery } from '../validation/schemas.js';
import { getCurrentChatters, getUserBySearch } from '../controllers/userController.js';

const router = express.Router();

router.get('/search',isLogin,searchLimiter,validate({query:searchQuery}),getUserBySearch);
router.get('/currentchatters',isLogin,getCurrentChatters);

export default router;
