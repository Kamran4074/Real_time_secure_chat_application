import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import ForgotPassword from '../password/ForgotPassword';
import ResetPassword from '../password/ResetPassword';
import { AuthContextProvider } from '../context/AuthContext';

vi.mock('axios');
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const TOKEN = 'a'.repeat(64);

const renderAt = (url) => render(
    <AuthContextProvider>
        <MemoryRouter initialEntries={[url]}>
            <Routes>
                <Route path='/forgot-password' element={<ForgotPassword />} />
                <Route path='/reset-password' element={<ResetPassword />} />
                <Route path='/login' element={<p>Login page</p>} />
            </Routes>
        </MemoryRouter>
    </AuthContextProvider>
);

beforeEach(() => vi.resetAllMocks());

describe('Forgot password page', () => {
    test('validates the email before sending', async () => {
        renderAt('/forgot-password');
        await userEvent.type(screen.getByLabelText('Email'), 'nope');
        await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

        expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address');
        expect(axios.post).not.toHaveBeenCalled();
    });

    test('sends the request and shows the confirmation', async () => {
        axios.post.mockResolvedValue({ data: { success: true } });
        renderAt('/forgot-password');
        await userEvent.type(screen.getByLabelText('Email'), 'aisha@x.com');
        await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

        expect(axios.post).toHaveBeenCalledWith('/api/auth/forgot-password', { email: 'aisha@x.com' });
        expect(await screen.findByRole('status')).toHaveTextContent('aisha@x.com');
        expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    });

    test('shows the server error (e.g. rate limit)', async () => {
        axios.post.mockRejectedValue({ response: { data: { message: 'Too many attempts, please try again later' } } });
        renderAt('/forgot-password');
        await userEvent.type(screen.getByLabelText('Email'), 'aisha@x.com');
        await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

        expect(toast.error).toHaveBeenCalledWith('Too many attempts, please try again later');
        expect(screen.queryByRole('heading', { name: 'Check your email' })).not.toBeInTheDocument();
    });
});

describe('Reset password page', () => {
    const fill = async (password, confirm = password) => {
        await userEvent.type(screen.getByLabelText('New password'), password);
        await userEvent.type(screen.getByLabelText('Confirm new password'), confirm);
        await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
    };

    test('a link without a valid token shows the "request a new link" screen', () => {
        renderAt('/reset-password?token=broken');
        expect(screen.getByRole('alert')).toHaveTextContent('incomplete or broken');
        expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password');
    });

    test('mismatched passwords are caught before sending', async () => {
        renderAt(`/reset-password?token=${TOKEN}`);
        await fill('secret1', 'secret2');

        expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
        expect(axios.post).not.toHaveBeenCalled();
    });

    test('updates the password, clears the old session and goes to login', async () => {
        localStorage.setItem('chatapp', JSON.stringify({ _id: '1', token: 'old' }));
        axios.post.mockResolvedValue({ data: { message: 'Password updated, please log in' } });
        renderAt(`/reset-password?token=${TOKEN}`);
        await fill('newpass1');

        expect(axios.post).toHaveBeenCalledWith('/api/auth/reset-password', { token: TOKEN, password: 'newpass1' });
        expect(await screen.findByText('Login page')).toBeInTheDocument();
        expect(localStorage.getItem('chatapp')).toBeNull();
        expect(toast.success).toHaveBeenCalledWith('Password updated, please log in');
    });

    test('an expired link from the server switches to the invalid-link screen', async () => {
        axios.post.mockRejectedValue({ response: { data: { message: 'This reset link is invalid or has expired' } } });
        renderAt(`/reset-password?token=${TOKEN}`);
        await fill('newpass1');

        expect(await screen.findByRole('heading', { name: 'Link not valid' })).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent('invalid or has expired');
    });
});
