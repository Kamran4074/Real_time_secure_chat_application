import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import OAuthHandler from '../components/OAuthHandler';
import { VerifyUser } from '../utils/VerifyUser';
import { AuthContextProvider } from '../context/AuthContext';

vi.mock('axios');
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const renderAt = (search) => {
    window.history.replaceState(null, '', `/${search}`);
    return render(
        <AuthContextProvider>
            <MemoryRouter initialEntries={['/']}>
                <OAuthHandler />
                <Routes>
                    <Route element={<VerifyUser />}>
                        <Route path='/' element={<p>Home page</p>} />
                    </Route>
                    <Route path='/login' element={<p>Login page</p>} />
                </Routes>
            </MemoryRouter>
        </AuthContextProvider>
    );
};

describe('OAuthHandler', () => {
    beforeEach(() => vi.resetAllMocks());

    test('exchanges the one-time code, logs in and cleans the URL', async () => {
        const user = { _id: '1', fullname: 'Aisha Khan', token: 't' };
        axios.post.mockResolvedValue({ data: user });
        renderAt('?oauth_code=' + 'a'.repeat(64));

        expect(screen.getByText('Signing you in…')).toBeInTheDocument();
        expect(await screen.findByText('Home page')).toBeInTheDocument();
        expect(axios.post).toHaveBeenCalledWith('/api/auth/oauth/exchange', { code: 'a'.repeat(64) });
        expect(window.location.search).toBe('');
        expect(JSON.parse(localStorage.getItem('chatapp'))).toEqual(user);
        expect(toast.success).toHaveBeenCalledWith('Welcome, Aisha!');
    });

    test('a failed exchange sends the user to login', async () => {
        axios.post.mockRejectedValue({ response: { data: { message: 'Invalid sign-in code' } } });
        renderAt('?oauth_code=bad');

        expect(await screen.findByText('Login page')).toBeInTheDocument();
        expect(toast.error).toHaveBeenCalledWith('Invalid sign-in code');
    });

    test('an oauth_error shows a friendly message without calling the API', async () => {
        renderAt('?oauth_error=cancelled');

        await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('Sign-in was cancelled.'));
        expect(axios.post).not.toHaveBeenCalled();
    });

    test('a logged-out visitor on a protected page is redirected to login', () => {
        renderAt('');
        expect(screen.getByText('Login page')).toBeInTheDocument();
    });
});
