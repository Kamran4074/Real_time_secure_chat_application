import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import Login from '../login/Login';
import { AuthContextProvider } from '../context/AuthContext';

vi.mock('axios');
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const renderLogin = () => render(
    <AuthContextProvider>
        <MemoryRouter initialEntries={['/login']}>
            <Routes>
                <Route path='/login' element={<Login />} />
                <Route path='/' element={<p>Home page</p>} />
            </Routes>
        </MemoryRouter>
    </AuthContextProvider>
);

const fillAndSubmit = async (email, password) => {
    if (email) await userEvent.type(screen.getByLabelText('Email'), email);
    if (password) await userEvent.type(screen.getByLabelText('Password'), password);
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
};

describe('Login page', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        axios.get.mockResolvedValue({ data: { providers: [] } }); // OAuthButtons
    });

    test('shows field errors and does not call the API when the form is invalid', async () => {
        renderLogin();
        await fillAndSubmit('not-an-email', '');

        expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
        expect(screen.getByText('Password is required')).toBeInTheDocument();
        expect(axios.post).not.toHaveBeenCalled();
    });

    test('logs in, saves the session and goes to the home page', async () => {
        const user = { _id: '1', username: 'aisha', token: 'jwt-token', message: 'Login Successful' };
        axios.post.mockResolvedValue({ data: user });
        renderLogin();

        await fillAndSubmit('aisha@x.com', 'secret1');

        expect(axios.post).toHaveBeenCalledWith('/api/auth/login', { email: 'aisha@x.com', password: 'secret1' });
        expect(await screen.findByText('Home page')).toBeInTheDocument();
        expect(JSON.parse(localStorage.getItem('chatapp'))).toEqual(user);
        expect(toast.success).toHaveBeenCalledWith('Login Successful');
    });

    test('shows the server error when login fails', async () => {
        axios.post.mockRejectedValue({ response: { data: { message: 'Invalid email or password' } } });
        renderLogin();

        await fillAndSubmit('aisha@x.com', 'wrong-pass');

        expect(toast.error).toHaveBeenCalledWith('Invalid email or password');
        expect(screen.queryByText('Home page')).not.toBeInTheDocument();
        expect(localStorage.getItem('chatapp')).toBeNull();
    });
});
