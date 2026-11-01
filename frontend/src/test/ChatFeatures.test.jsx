import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import MessageContainer from '../home/components/MessageContainer';
import useConversation from '../store/useConversation';
import { AuthContextProvider } from '../context/AuthContext';
import { lastSeenLabel } from '../utils/lastSeen';

// fake socket that remembers its listeners, so tests can "receive" events
const handlers = {};
const socket = {
    on: vi.fn((event, fn) => { handlers[event] = fn; }),
    off: vi.fn(),
    emit: vi.fn(),
};
let socketState = { socket, onlineUser: [], lastSeen: {} };
vi.mock('axios');
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../context/SocketContext', () => ({ useSocketContext: () => socketState }));
vi.mock('../assets/sound/notification.mp3', () => ({ default: '' }));

Element.prototype.scrollIntoView = vi.fn();
window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());

const me = { _id: 'a1', username: 'aisha', token: 't' };
const bilal = { _id: 'b1', fullname: 'Bilal Ahmed', username: 'bilal' };
const msg = (i, extra = {}) => ({
    _id: `m${String(i).padStart(3, '0')}`, senderId: 'a1', recieverId: 'b1', message: `text ${i}`,
    createdAt: new Date(2026, 9, 31, 10, i).toISOString(), deliveredAt: null, seenAt: null, ...extra,
});

const renderChat = () => {
    localStorage.setItem('chatapp', JSON.stringify(me));
    return render(<AuthContextProvider><MessageContainer onBackUser={vi.fn()} /></AuthContextProvider>);
};

beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(handlers).forEach(k => delete handlers[k]);
    socketState = { socket, onlineUser: [], lastSeen: {} };
    useConversation.getState().reset();
    useConversation.getState().setSelectedConversation(bilal);
    axios.post.mockResolvedValue({ data: {} });
});

describe('read receipts', () => {
    test('shows sent, delivered and seen ticks on my messages', async () => {
        axios.get.mockResolvedValue({ data: [
            msg(1), msg(2, { deliveredAt: 'x' }), msg(3, { deliveredAt: 'x', seenAt: 'y' }),
        ] });
        renderChat();
        expect(await screen.findByLabelText('Sent')).toBeInTheDocument();
        expect(screen.getByLabelText('Delivered')).toBeInTheDocument();
        expect(screen.getByLabelText('Seen')).toBeInTheDocument();
    });

    test('ticks update live when the receiver gets and reads them', async () => {
        axios.get.mockResolvedValue({ data: [msg(1)] });
        renderChat();
        await screen.findByLabelText('Sent');

        act(() => handlers.messagesDelivered({ receiverId: 'b1', at: '2026-10-31T10:00:00Z' }));
        expect(screen.getByLabelText('Delivered')).toBeInTheDocument();
        act(() => handlers.messagesSeen({ receiverId: 'b1', at: '2026-10-31T10:01:00Z' }));
        expect(screen.getByLabelText('Seen')).toBeInTheDocument();
    });

    test('opening a chat with unseen messages from them marks them seen once', async () => {
        axios.get.mockResolvedValue({ data: [msg(1, { senderId: 'b1', recieverId: 'a1' })] });
        renderChat();
        await waitFor(() => expect(axios.post).toHaveBeenCalledWith('/api/message/seen/b1'));
        expect(axios.post).toHaveBeenCalledTimes(1);
    });

    test('a new message in the open chat is marked seen; nothing to mark means no request', async () => {
        axios.get.mockResolvedValue({ data: [msg(1)] }); // only my own messages
        renderChat();
        await screen.findByText('text 1');
        expect(axios.post).not.toHaveBeenCalled();

        act(() => handlers.newMessage(msg(2, { senderId: 'b1', recieverId: 'a1' })));
        await waitFor(() => expect(axios.post).toHaveBeenCalledWith('/api/message/seen/b1'));
    });
});

describe('pagination', () => {
    test('a full first page offers older messages; loading them keeps order and stops at a short page', async () => {
        const firstPage = Array.from({ length: 30 }, (_, i) => msg(i + 10));
        const olderPage = Array.from({ length: 5 }, (_, i) => msg(i + 1));
        axios.get.mockImplementation(async (url, config) => ({ data: config?.params?.before ? olderPage : firstPage }));
        renderChat();

        await userEvent.click(await screen.findByRole('button', { name: 'Load older messages' }));
        expect(axios.get).toHaveBeenLastCalledWith('/api/message/b1', { params: { before: 'm010' } });
        await screen.findByText('text 1');

        const ids = useConversation.getState().messages.map(m => m._id);
        expect(ids[0]).toBe('m001');
        expect(ids).toHaveLength(35);
        expect(screen.queryByRole('button', { name: 'Load older messages' })).not.toBeInTheDocument();
    });

    test('a short first page means there is nothing older', async () => {
        axios.get.mockResolvedValue({ data: [msg(1)] });
        renderChat();
        await screen.findByText('text 1');
        expect(screen.queryByRole('button', { name: 'Load older messages' })).not.toBeInTheDocument();
    });
});

describe('last seen', () => {
    const now = new Date(2026, 9, 31, 18, 0);
    test.each([
        [new Date(2026, 9, 31, 17, 59, 30), 'last seen just now'],
        [new Date(2026, 9, 31, 9, 5), /^last seen today at 9:05/i],
        [new Date(2026, 9, 30, 21, 0), /^last seen yesterday at 9:00/i],
        [new Date(2026, 9, 2, 8, 0), /^last seen 2 Oct at 8:00/i],
        ['garbage', null],
    ])('%s -> %s', (date, expected) => {
        const label = lastSeenLabel(date, now);
        if (expected instanceof RegExp) expect(label).toMatch(expected);
        else expect(label).toBe(expected);
    });

    test('the chat header shows last seen for an offline contact', async () => {
        socketState = { ...socketState, lastSeen: { b1: new Date().toISOString() } };
        axios.get.mockResolvedValue({ data: [] });
        renderChat();
        expect(await screen.findByText('last seen just now')).toBeInTheDocument();
    });
});
