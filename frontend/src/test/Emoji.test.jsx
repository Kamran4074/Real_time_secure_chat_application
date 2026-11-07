import { describe, test, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessageComposer from '../features/chat/components/MessageComposer';
import MessageBubble from '../features/chat/components/MessageBubble';
import isEmojiOnly from '../features/chat/emoji/isEmojiOnly';

const renderComposer = (props = {}) => {
    const handlers = { onSend: vi.fn(async () => true), onTyping: vi.fn(), onStopTyping: vi.fn(), ...props };
    render(<MessageComposer name='Bilal' sending={false} {...handlers} />);
    return handlers;
};
const input = () => screen.getByLabelText('Type a message');
const openPicker = async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Add emoji' }));
    return screen.findByRole('dialog', { name: 'Emoji picker' });
};

describe('emoji picker', () => {
    test('adds emoji to the message and stays open for more', async () => {
        const { onTyping } = renderComposer();
        const picker = await openPicker();

        await userEvent.click(within(picker).getByRole('button', { name: 'joy tears' }));
        await userEvent.click(within(picker).getByRole('tab', { name: 'Hearts' }));
        await userEvent.click(within(picker).getByRole('button', { name: 'red heart' }));

        expect(input()).toHaveValue('😂❤️');
        expect(onTyping).toHaveBeenLastCalledWith('😂❤️'); // the other person sees "typing…"
        expect(screen.getByRole('dialog', { name: 'Emoji picker' })).toBeInTheDocument();
    });

    test('inserts at the cursor, not at the end', async () => {
        renderComposer();
        await userEvent.type(input(), 'hi there');
        input().setSelectionRange(2, 2);
        const picker = await openPicker();

        await userEvent.click(within(picker).getByRole('tab', { name: 'Gestures' }));
        await userEvent.click(within(picker).getByRole('button', { name: 'wave hello' }));
        expect(input()).toHaveValue('hi👋 there');
        await waitFor(() => expect(input().selectionStart).toBe(2 + '👋'.length));
    });

    test('search finds emoji by name and says when nothing matches', async () => {
        renderComposer();
        const picker = await openPicker();
        const search = within(picker).getByRole('searchbox', { name: 'Search emoji' });
        expect(search).toHaveFocus();

        await userEvent.type(search, 'pizza');
        expect(within(picker).getByText('Results · 1')).toBeInTheDocument();
        expect(within(picker).getByRole('button', { name: 'pizza' })).toHaveTextContent('🍕');

        await userEvent.clear(search);
        await userEvent.type(search, 'zzzz');
        expect(within(picker).getByText('No emoji found')).toBeInTheDocument();
    });

    test('category tabs switch the grid', async () => {
        renderComposer();
        const picker = await openPicker();
        await userEvent.click(within(picker).getByRole('tab', { name: 'Food & Drink' }));
        expect(within(picker).getByRole('tab', { name: 'Food & Drink' })).toHaveAttribute('aria-selected', 'true');
        expect(within(picker).getByRole('button', { name: 'pizza' })).toBeInTheDocument();
    });

    test('Esc, a click outside, or the emoji button again closes it', async () => {
        renderComposer();
        const closed = () => expect(screen.queryByRole('dialog', { name: 'Emoji picker' })).not.toBeInTheDocument();

        await openPicker();
        await userEvent.keyboard('{Escape}');
        closed();

        await openPicker();
        await userEvent.click(document.body);
        closed();

        await openPicker();
        await userEvent.click(screen.getByRole('button', { name: 'Close emoji picker' }));
        closed();
    });

    test('sending closes the picker and sends the emoji', async () => {
        const { onSend } = renderComposer();
        const picker = await openPicker();
        await userEvent.click(within(picker).getByRole('tab', { name: 'Gestures' }));
        await userEvent.click(within(picker).getByRole('button', { name: 'thumbs up' }));
        await userEvent.click(screen.getByRole('button', { name: 'Send message' }));

        expect(onSend).toHaveBeenCalledWith('👍');
        await waitFor(() => expect(input()).toHaveValue(''));
        expect(screen.queryByRole('dialog', { name: 'Emoji picker' })).not.toBeInTheDocument();
    });
});

describe('big emoji messages', () => {
    test.each([
        ['😂', true], ['❤️👍', true], ['🔥 🔥', true], ['👨‍💻', true], ['🇮🇳', true],
        ['😂😂😂😂', false], ['hi 😂', false], ['123', false], ['', false], ['ok', false],
    ])('isEmojiOnly(%j) -> %s', (text, expected) => {
        expect(isEmojiOnly(text)).toBe(expected);
    });

    const msg = (text) => ({ _id: 'm1', senderId: 'a1', message: text, createdAt: new Date().toISOString(), deliveredAt: null, seenAt: null });

    test('a message of only emoji is shown large, without a bubble', () => {
        render(<MessageBubble message={msg('🎉')} mine />);
        expect(screen.getByTestId('big-emoji')).toHaveTextContent('🎉');
        expect(screen.getByLabelText('Sent')).toBeInTheDocument();
    });

    test('text with emoji stays a normal bubble', () => {
        render(<MessageBubble message={msg('congrats 🎉')} mine />);
        expect(screen.queryByTestId('big-emoji')).not.toBeInTheDocument();
        expect(screen.getByText('congrats 🎉')).toBeInTheDocument();
    });
});
