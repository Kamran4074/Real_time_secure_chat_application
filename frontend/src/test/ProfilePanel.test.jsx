import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import { toast } from 'react-toastify';
import ProfilePanel from '../home/components/ProfilePanel';
import { AuthContextProvider } from '../context/AuthContext';

vi.mock('axios');
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const session = { _id: 'u1', fullname: 'Aisha Khan', username: 'aisha', profilepic: '', token: 'jwt-token' };
const me = { ...session, email: 'aisha@x.com', bio: 'Hello', canUploadPhoto: true };
delete me.token;

const renderPanel = (onClose = vi.fn()) => {
    localStorage.setItem('chatapp', JSON.stringify(session));
    render(<AuthContextProvider><ProfilePanel onClose={onClose} /></AuthContextProvider>);
    return onClose;
};

beforeEach(() => {
    vi.resetAllMocks();
    axios.get.mockResolvedValue({ data: me });
});
afterEach(() => vi.unstubAllGlobals());

describe('ProfilePanel', () => {
    test('loads and shows the full profile', async () => {
        renderPanel();
        expect(await screen.findByDisplayValue('Hello')).toBeInTheDocument();
        expect(screen.getByText('aisha@x.com')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    });

    test('sends only the changed fields and keeps the session token', async () => {
        axios.patch.mockResolvedValue({ data: { ...me, bio: 'Busy' } });
        renderPanel();
        const bio = await screen.findByDisplayValue('Hello');
        await userEvent.clear(bio);
        await userEvent.type(bio, 'Busy');
        await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

        expect(axios.patch).toHaveBeenCalledWith('/api/user/me', { bio: 'Busy' });
        await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Profile updated'));
        expect(JSON.parse(localStorage.getItem('chatapp'))).toMatchObject({ bio: 'Busy', token: 'jwt-token' });
    });

    test('validates the username before sending', async () => {
        renderPanel();
        const username = await screen.findByDisplayValue('aisha');
        await userEvent.clear(username);
        await userEvent.type(username, 'a b');
        await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

        expect(screen.getByRole('alert')).toHaveTextContent('3–20 characters');
        expect(axios.patch).not.toHaveBeenCalled();
    });

    test('shows "username taken" from the server next to the field', async () => {
        axios.patch.mockRejectedValue({ response: { data: {
            message: 'Username already taken', errors: [{ field: 'username', message: 'Username already taken' }]
        } } });
        renderPanel();
        const username = await screen.findByDisplayValue('aisha');
        await userEvent.clear(username);
        await userEvent.type(username, 'bilal');
        await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Username already taken');
    });

    test('uploads a photo to Cloudinary without sending our JWT, then saves the URL', async () => {
        const url = 'https://res.cloudinary.com/demo/image/upload/v1/chatwave/avatars/u1.webp';
        axios.post.mockResolvedValue({ data: {
            uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload', apiKey: 'k', signature: 's', public_id: 'u1'
        } });
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ secure_url: url }) });
        vi.stubGlobal('fetch', fetchMock);
        axios.patch.mockResolvedValue({ data: { ...me, profilepic: url } });

        renderPanel();
        await screen.findByDisplayValue('Hello');
        const file = new File(['img'], 'me.png', { type: 'image/png' });
        await userEvent.upload(screen.getByTestId('photo-input'), file);

        await waitFor(() => expect(axios.patch).toHaveBeenCalledWith('/api/user/me', { profilepic: url }));
        const [uploadUrl, options] = fetchMock.mock.calls[0];
        expect(uploadUrl).toBe('https://api.cloudinary.com/v1_1/demo/image/upload');
        expect(options.headers).toBeUndefined();
        expect(options.body.get('file')).toBe(file);
        expect(options.body.get('public_id')).toBe('u1');
    });

    test('rejects files that are too big before uploading', async () => {
        renderPanel();
        await screen.findByDisplayValue('Hello');
        const big = new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', { type: 'image/png' });
        await userEvent.upload(screen.getByTestId('photo-input'), big);

        expect(toast.error).toHaveBeenCalledWith('Photo must be under 5 MB');
        expect(axios.post).not.toHaveBeenCalled();
    });

    test('Escape closes the panel', async () => {
        const onClose = renderPanel();
        await screen.findByDisplayValue('Hello');
        await userEvent.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalled();
    });
});
