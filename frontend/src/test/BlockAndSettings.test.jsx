import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import ContactPanel from '../home/components/ContactPanel';
import AccountSettings from '../home/components/AccountSettings';
import BlockedContacts from '../home/components/BlockedContacts';
import Sidebar from '../home/components/Sidebar';
import useConversation from '../store/useConversation';
import { AuthContextProvider } from '../context/AuthContext';
import { changePasswordSchema } from '../validation/authSchemas';

vi.mock('axios');
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('../context/SocketContext', () => ({ useSocketContext: () => ({ socket: null, onlineUser: [] }) }));

const bilal = { _id: 'b1', fullname: 'Bilal Ahmed', username: 'bilal', bio: 'At work', profilepic: '' };
const session = { _id: 'a1', fullname: 'Aisha Khan', username: 'aisha', token: 'old-token' };

const withAuth = (ui) => {
    localStorage.setItem('chatapp', JSON.stringify(session));
    return render(<AuthContextProvider><MemoryRouter>{ui}</MemoryRouter></AuthContextProvider>);
};

beforeEach(() => {
    vi.resetAllMocks();
    useConversation.getState().reset();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('blocked list in the store', () => {
    test('setBlocked adds once and removes', () => {
        const { setBlocked } = useConversation.getState();
        setBlocked('x', true);
        setBlocked('x', true);
        expect(useConversation.getState().blockedIds).toEqual(['x']);
        setBlocked('x', false);
        expect(useConversation.getState().blockedIds).toEqual([]);
    });
});

describe('ContactPanel', () => {
    test('shows the contact and blocks after confirming', async () => {
        axios.post.mockResolvedValue({ data: {} });
        withAuth(<ContactPanel user={bilal} online onClose={vi.fn()} />);
        expect(screen.getByText('At work')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Block Bilal Ahmed' }));
        expect(axios.post).toHaveBeenCalledWith('/api/user/block/b1');
        expect(await screen.findByRole('button', { name: 'Unblock Bilal Ahmed' })).toBeInTheDocument();
        expect(useConversation.getState().blockedIds).toEqual(['b1']);
    });

    test('unblocks a blocked contact', async () => {
        axios.delete.mockResolvedValue({ data: {} });
        useConversation.getState().setBlockedIds(['b1']);
        withAuth(<ContactPanel user={bilal} online={false} onClose={vi.fn()} />);

        await userEvent.click(screen.getByRole('button', { name: 'Unblock Bilal Ahmed' }));
        expect(axios.delete).toHaveBeenCalledWith('/api/user/block/b1');
        await waitFor(() => expect(useConversation.getState().blockedIds).toEqual([]));
    });

    test('nothing happens when the confirm is cancelled', async () => {
        window.confirm.mockReturnValue(false);
        withAuth(<ContactPanel user={bilal} online onClose={vi.fn()} />);
        await userEvent.click(screen.getByRole('button', { name: 'Block Bilal Ahmed' }));
        expect(axios.post).not.toHaveBeenCalled();
    });
});

describe('BlockedContacts', () => {
    test('lists blocked users and unblocks them', async () => {
        axios.get.mockResolvedValue({ data: [bilal] });
        axios.delete.mockResolvedValue({ data: {} });
        useConversation.getState().setBlockedIds(['b1']);
        withAuth(<BlockedContacts />);

        const row = (await screen.findByText('Bilal Ahmed')).closest('li');
        await userEvent.click(within(row).getByRole('button', { name: 'Unblock' }));
        expect(axios.delete).toHaveBeenCalledWith('/api/user/block/b1');
        expect(await screen.findByText(/haven.t blocked anyone/)).toBeInTheDocument();
    });
});

describe('AccountSettings', () => {
    const profile = { hasPassword: true, linkedAccounts: { google: true, github: false } };

    test('shows linked sign-in methods', () => {
        withAuth(<AccountSettings profile={profile} onSignedOut={vi.fn()} />);
        expect(screen.getByText('Linked')).toBeInTheDocument();
        expect(screen.getByText('Not linked')).toBeInTheDocument();
    });

    test('changes the password and keeps the new token', async () => {
        axios.post.mockResolvedValue({ data: { message: 'Password changed', token: 'new-token' } });
        withAuth(<AccountSettings profile={profile} onSignedOut={vi.fn()} />);

        await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
        await userEvent.type(screen.getByLabelText('Current password'), 'secret123');
        await userEvent.type(screen.getByLabelText('New password'), 'newsecret1');
        await userEvent.type(screen.getByLabelText('Confirm new password'), 'newsecret1');
        await userEvent.click(screen.getAllByRole('button', { name: 'Change password' }).at(-1));

        expect(axios.post).toHaveBeenCalledWith('/api/auth/change-password', { currentPassword: 'secret123', newPassword: 'newsecret1' });
        await waitFor(() => expect(JSON.parse(localStorage.getItem('chatapp')).token).toBe('new-token'));
    });

    test('Google-only accounts set a password without the current one', async () => {
        axios.post.mockResolvedValue({ data: { message: 'Password set', token: 't' } });
        withAuth(<AccountSettings profile={{ hasPassword: false, linkedAccounts: { google: true } }} onSignedOut={vi.fn()} />);

        await userEvent.click(screen.getByRole('button', { name: 'Set a password' }));
        expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
        await userEvent.type(screen.getByLabelText('New password'), 'firstpass1');
        await userEvent.type(screen.getByLabelText('Confirm new password'), 'firstpass1');
        await userEvent.click(screen.getByRole('button', { name: 'Set password' }));
        expect(axios.post).toHaveBeenCalledWith('/api/auth/change-password', { newPassword: 'firstpass1' });
    });

    test('shows a wrong current password next to the field', async () => {
        axios.post.mockRejectedValue({ response: { data: {
            message: 'Current password is incorrect', errors: [{ field: 'currentPassword', message: 'Current password is incorrect' }]
        } } });
        withAuth(<AccountSettings profile={profile} onSignedOut={vi.fn()} />);
        await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
        await userEvent.type(screen.getByLabelText('Current password'), 'wrong');
        await userEvent.type(screen.getByLabelText('New password'), 'newsecret1');
        await userEvent.type(screen.getByLabelText('Confirm new password'), 'newsecret1');
        await userEvent.click(screen.getAllByRole('button', { name: 'Change password' }).at(-1));

        expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect');
    });

    test('log out from all devices ends the local session', async () => {
        axios.post.mockResolvedValue({ data: { message: 'Logged out from all devices' } });
        const onSignedOut = vi.fn();
        withAuth(<AccountSettings profile={profile} onSignedOut={onSignedOut} />);
        await userEvent.click(screen.getByRole('button', { name: 'Log out from all devices' }));

        expect(axios.post).toHaveBeenCalledWith('/api/auth/logout-all');
        await waitFor(() => expect(onSignedOut).toHaveBeenCalled());
    });

    test('schema: passwords must match, current one only when the account has one', () => {
        expect(changePasswordSchema(true).safeParse({ currentPassword: '', newPassword: 'abcdef', confpassword: 'abcdef' }).success).toBe(false);
        expect(changePasswordSchema(false).safeParse({ newPassword: 'abcdef', confpassword: 'abcdef' }).success).toBe(true);
        expect(changePasswordSchema(false).safeParse({ newPassword: 'abcdef', confpassword: 'abcdeg' }).success).toBe(false);
    });
});

describe('Sidebar search', () => {
    beforeEach(() => {
        axios.get.mockImplementation(async (url, config) => {
            if (url === '/api/user/search') return { data: [{ ...bilal, username: config.params.search }] };
            return { data: [] };
        });
    });
    const searchCalls = () => axios.get.mock.calls.filter(([url]) => url === '/api/user/search');

    test('searches once typing pauses, not on every key', async () => {
        withAuth(<Sidebar />);
        await userEvent.type(screen.getByRole('textbox', { name: /search people/i }), 'bil');

        await waitFor(() => expect(searchCalls()).toHaveLength(1));
        expect(searchCalls()[0][1]).toEqual({ params: { search: 'bil' } });
        expect(await screen.findByText('Search results · 1')).toBeInTheDocument();
    });

    test('ignores a leading @ and needs 2 characters', async () => {
        withAuth(<Sidebar />);
        const box = screen.getByRole('textbox', { name: /search people/i });
        await userEvent.type(box, '@b');
        await new Promise((resolve) => setTimeout(resolve, 400));
        expect(searchCalls()).toHaveLength(0);

        await userEvent.type(box, 'i');
        await waitFor(() => expect(searchCalls()[0][1]).toEqual({ params: { search: 'bi' } }));
    });

    test('loads who I blocked', async () => {
        axios.get.mockImplementation(async (url) => ({ data: url === '/api/user/blocked' ? [bilal] : [] }));
        withAuth(<Sidebar />);
        await waitFor(() => expect(useConversation.getState().blockedIds).toEqual(['b1']));
        expect(toast.error).not.toHaveBeenCalled();
    });
});

describe('online status', () => {
    test('contact info shows a green Online, or a plain Offline', async () => {
        const { unmount } = withAuth(<ContactPanel user={bilal} online onClose={vi.fn()} />);
        expect(screen.getByText('Online')).toHaveClass('text-emerald-600');
        unmount();
        localStorage.clear();
        withAuth(<ContactPanel user={bilal} online={false} onClose={vi.fn()} />);
        expect(screen.getByText('Offline')).toHaveClass('text-slate-500');
        expect(screen.queryByText('Online')).not.toBeInTheDocument();
    });
});
