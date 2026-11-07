import api, { BACKEND_URL } from '../../shared/api/client';

// Every call to the backend's auth module (/api/auth)

export const login = (credentials) => api.post('/api/auth/login', credentials).then((r) => r.data);

export const register = (account) => api.post('/api/auth/register', account).then((r) => r.data);

export const logout = () => api.post('/api/auth/logout').then((r) => r.data);

export const logoutEverywhere = () => api.post('/api/auth/logout-all').then((r) => r.data);

export const changePassword = (body) => api.post('/api/auth/change-password', body).then((r) => r.data);

export const forgotPassword = (body) => api.post('/api/auth/forgot-password', body).then((r) => r.data);

export const resetPassword = (body) => api.post('/api/auth/reset-password', body).then((r) => r.data);

export const getProviders = () => api.get('/api/auth/providers').then((r) => r.data.providers || []);

export const exchangeOAuthCode = (code) => api.post('/api/auth/oauth/exchange', { code }).then((r) => r.data);

// full-page redirect target: the backend sends the user on to Google / GitHub
export const oauthStartUrl = (provider) => `${BACKEND_URL}/api/auth/${provider}`;
