import axios from 'axios';
import { loadSession, clearSession, hasSavedSession } from '../lib/session';

// The one HTTP client of the app. Features call it from their own api.js, never from components.
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// Called once at startup (main.jsx)
export const configureApiClient = () => {
    axios.defaults.baseURL = BACKEND_URL;
    axios.defaults.withCredentials = true;

    // the token travels as a header too: some browsers block the cross-site cookie
    axios.interceptors.request.use((config) => {
        const token = loadSession()?.token;
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
    });

    // token expired or revoked -> drop the stale session and go to login
    axios.interceptors.response.use(
        (response) => response,
        (error) => {
            if (error?.response?.status === 401 && hasSavedSession()) {
                clearSession();
                window.location.href = '/login';
            }
            return Promise.reject(error);
        }
    );
};

// the backend's message for a failed request, or a fallback
export const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;

// the backend's error body ({ success, code, message, errors? }) of a failed request
export const errorBody = (error) => error?.response?.data;

export const checkHealth = () => axios.get('/api/health', { timeout: 60000 });

export default axios;
