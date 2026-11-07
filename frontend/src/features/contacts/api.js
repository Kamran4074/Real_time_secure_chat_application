import api from '../../shared/api/client';

// Calls to the backend's users module (/api/user) and the recent-chats list (/api/message/conversations)

export const getRecentChats = () => api.get('/api/message/conversations').then((r) => r.data);

export const searchUsers = (search) => api.get('/api/user/search', { params: { search } }).then((r) => r.data);

export const getBlockedUsers = () => api.get('/api/user/blocked').then((r) => r.data);

export const blockUser = (userId) => api.post(`/api/user/block/${userId}`);

export const unblockUser = (userId) => api.delete(`/api/user/block/${userId}`);
