import express from 'express';
import { requireAuth } from '../auth/index.js';
import validate from '../../shared/middleware/validate.js';
import { apiLimiter, searchLimiter } from '../../shared/middleware/rateLimiters.js';
import { userIdParams } from '../../shared/validation.js';
import { searchQuery, updateProfileSchema } from './users.schemas.js';
import * as controller from './users.controller.js';

export const basePath = '/user';
export const router = express.Router();

// overall cap per IP, shared by every module (stricter limits are added per route below)
router.use(apiLimiter);

router.use(requireAuth);

router.get('/search', searchLimiter, validate({query: searchQuery}), controller.search);

// your own profile
router.get('/me', controller.getMe);
router.patch('/me', validate({body: updateProfileSchema}), controller.updateMe);
router.post('/me/avatar-signature', controller.getAvatarUploadSignature);

// blocking
router.get('/blocked', controller.getBlockedUsers);
router.post('/block/:id', validate({params: userIdParams}), controller.blockUser);
router.delete('/block/:id', validate({params: userIdParams}), controller.unblockUser);
