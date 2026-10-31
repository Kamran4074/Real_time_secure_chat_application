import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import Register from '../register/Register';
import { AuthContextProvider } from '../context/AuthContext';

vi.mock('axios');
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const renderRegister = () => render(
    <AuthContextProvider>
        <MemoryRouter initialEntries={['/register']}>
            <Routes>
                <Route path='/register' element={<Register />} />
                <Route path='/' element={<p>Home page</p>} />
            </Routes>
        </MemoryRouter>
    </AuthContextProvider>
);

const fillForm = async ({ confirm = 'secret1' } = {}) => {
    await userEvent.type(screen.getByLabelText('Full name'), 'Aisha Khan');
    await userEvent.type(screen.getByLabelText('Username'), 'aisha_k');
    await userEvent.type(screen.getByLabelText('Email'), 'aisha@x.com');
    await userEvent.type(screen.getByLabelText('Password'), 'secret1');
    await userEvent.type(screen.getByLabelText('Confirm password'), confirm);
    await userEvent.click(screen.getByLabelText('female'));
};

const submit = () => userEvent.click(screen.getByRole('button', { name: /create account/i }));

describe('Register page', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        axios.get.mockResolvedValue({ data: { providers: [] } });
    });

    test('empty form shows an error for every field', async () => {
        renderRegister();
        await submit();

        expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(5);
        expect(axios.post).not.toHaveBeenCalled();
    });

    test('mismatched passwords are caught before sending', async () => {
        renderRegister();
        await fillForm({ confirm: 'different' });
        await submit();

        expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
        expect(axios.post).not.toHaveBeenCalled();
    });

    test('registers without sending confpassword and opens the home page', async () => {
        axios.post.mockResolvedValue({ data: { _id: '1', username: 'aisha_k', token: 't', message: 'Registered' } });
        renderRegister();
        await fillForm();
        await submit();

        expect(axios.post).toHaveBeenCalledWith('/api/auth/register', {
            fullname: 'Aisha Khan', username: 'aisha_k', email: 'aisha@x.com', password: 'secret1', gender: 'female',
        });
        expect(await screen.findByText('Home page')).toBeInTheDocument();
    });

    test('a taken username is shown next to the username field', async () => {
        axios.post.mockRejectedValue({ response: { data: { message: 'Username already exists' } } });
        renderRegister();
        await fillForm();
        await submit();

        expect(await screen.findByRole('alert')).toHaveTextContent('Username already exists');
        expect(screen.getByLabelText('Username')).toHaveAttribute('aria-invalid', 'true');
        expect(toast.error).toHaveBeenCalledWith('Username already exists');
    });
});
