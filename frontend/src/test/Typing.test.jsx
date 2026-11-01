import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import MessageContainer from '../home/components/MessageContainer';
import useConversation from '../store/useConversation';
import { AuthContextProvider } from '../context/AuthContext';

const socket = { on: vi.fn(), off: vi.fn(), emit: vi.fn() };
vi.mock('axios');
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../context/SocketContext', () => ({ useSocketContext: () => ({ socket, onlineUser: [] }) }));

const bilal = { _id: 'b1', fullname: 'Bilal Ahmed', username: 'bilal' };
const emitted = (event) => socket.emit.mock.calls.filter(([name]) => name === event);

// jsdom has no layout, so no scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

beforeEach(() => {
    vi.clearAllMocks();
    axios.get.mockResolvedValue({ data: [] });
    useConversation.getState().reset();
    useConversation.getState().setSelectedConversation(bilal);
    localStorage.setItem('chatapp', JSON.stringify({ _id: 'a1', username: 'aisha', token: 't' }));
});

describe('typing indicator events', () => {
    test('one "typing" per burst of keys, one "stopTyping" after a 2 s pause', async () => {
        render(<AuthContextProvider><MessageContainer onBackUser={vi.fn()} /></AuthContextProvider>);
        await userEvent.type(screen.getByLabelText('Type a message'), 'hello');

        expect(emitted('typing')).toEqual([['typing', { receiverId: 'b1' }]]);
        expect(emitted('stopTyping')).toHaveLength(0);
        await waitFor(() => expect(emitted('stopTyping')).toEqual([['stopTyping', { receiverId: 'b1' }]]), { timeout: 3000 });
    });

    test('sending ends the burst right away', async () => {
        axios.post.mockResolvedValue({ data: { _id: 'm1', senderId: 'a1', message: 'hi', createdAt: new Date().toISOString() } });
        render(<AuthContextProvider><MessageContainer onBackUser={vi.fn()} /></AuthContextProvider>);
        await userEvent.type(screen.getByLabelText('Type a message'), 'hi{Enter}');

        expect(emitted('stopTyping')).toHaveLength(1);
        // a new burst starts with a fresh "typing"
        await userEvent.type(screen.getByLabelText('Type a message'), 'again');
        expect(emitted('typing')).toHaveLength(2);
    });
});
