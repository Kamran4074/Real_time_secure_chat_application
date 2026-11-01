import express from 'express';
import isLogin from '../middleware/isLogin.js'
import validate from '../middleware/validate.js';
import { searchLimiter } from '../middleware/rateLimiters.js';
import { searchQuery, updateProfileSchema, userIdParams } from '../validation/schemas.js';
import { getCurrentChatters, getUserBySearch, getMe, updateMe, getAvatarUploadSignature, getBlockedUsers, blockUser, unblockUser } from '../controllers/userController.js';

const router = express.Router();

router.get('/search',isLogin,searchLimiter,validate({query:searchQuery}),getUserBySearch);
router.get('/currentchatters',isLogin,getCurrentChatters);

// your own profile
router.get('/me',isLogin,getMe);
router.patch('/me',isLogin,validate({body:updateProfileSchema}),updateMe);
router.post('/me/avatar-signature',isLogin,getAvatarUploadSignature);

// blocking
router.get('/blocked',isLogin,getBlockedUsers);
router.post('/block/:id',isLogin,validate({params:userIdParams}),blockUser);
router.delete('/block/:id',isLogin,validate({params:userIdParams}),unblockUser);

export default router;
