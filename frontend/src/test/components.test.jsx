import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import TextField from '../components/ui/TextField';
import Avatar from '../components/ui/Avatar';
import OAuthButtons from '../components/OAuthButtons';

vi.mock('axios');

describe('TextField', () => {
    test('links the label to the input', () => {
        render(<TextField id='email' label='Email' />);
        expect(screen.getByLabelText('Email')).toHaveAttribute('id', 'email');
    });

    test('shows the error and marks the input invalid', () => {
        render(<TextField id='email' label='Email' error='Enter a valid email address' />);
        expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address');
        expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    });

    test('password field can be shown and hidden', async () => {
        render(<TextField id='password' label='Password' type='password' />);
        const input = screen.getByLabelText('Password');
        expect(input).toHaveAttribute('type', 'password');

        await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
        expect(input).toHaveAttribute('type', 'text');

        await userEvent.click(screen.getByRole('button', { name: 'Hide password' }));
        expect(input).toHaveAttribute('type', 'password');
    });
});

describe('Avatar', () => {
    test('shows initials of the first two names', () => {
        render(<Avatar user={{ fullname: 'aisha khan begum' }} />);
        expect(screen.getByText('AK')).toBeInTheDocument();
    });

    test('shows the online dot only when online', () => {
        const { rerender } = render(<Avatar user={{ fullname: 'Bob' }} />);
        expect(screen.queryByLabelText('online')).not.toBeInTheDocument();
        rerender(<Avatar user={{ fullname: 'Bob' }} online />);
        expect(screen.getByLabelText('online')).toBeInTheDocument();
    });
});

describe('OAuthButtons', () => {
    beforeEach(() => vi.resetAllMocks());

    test('enables only the providers the backend reports', async () => {
        axios.get.mockResolvedValue({ data: { providers: ['google'] } });
        render(<OAuthButtons />);

        expect(await screen.findByRole('button', { name: /Google/ })).toBeEnabled();
        expect(screen.getByRole('button', { name: /GitHub/ })).toBeDisabled();
        expect(axios.get).toHaveBeenCalledWith('/api/auth/providers');
    });

    test('keeps every button disabled if the backend is unreachable', async () => {
        axios.get.mockRejectedValue(new Error('offline'));
        render(<OAuthButtons />);

        await vi.waitFor(() => expect(axios.get).toHaveBeenCalled());
        expect(screen.getByRole('button', { name: /Google/ })).toBeDisabled();
    });
});
