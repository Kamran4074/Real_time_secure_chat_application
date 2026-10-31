import { describe, test, expect, beforeEach } from 'vitest';
import useConversation from '../store/useConversation';

describe('useConversation store', () => {
    beforeEach(() => useConversation.getState().reset());

    test('selects a conversation', () => {
        useConversation.getState().setSelectedConversation({ _id: '1', username: 'bob' });
        expect(useConversation.getState().selectedConversation.username).toBe('bob');
    });

    test('addMessage appends to the latest list', () => {
        const { setMessage, addMessage } = useConversation.getState();
        setMessage([{ _id: 'a' }]);
        addMessage({ _id: 'b' });
        addMessage({ _id: 'c' });
        expect(useConversation.getState().messages.map(m => m._id)).toEqual(['a', 'b', 'c']);
    });

    test('reset clears the conversation and messages', () => {
        const state = useConversation.getState();
        state.setSelectedConversation({ _id: '1' });
        state.addMessage({ _id: 'a' });
        state.reset();
        expect(useConversation.getState()).toMatchObject({ selectedConversation: null, messages: [] });
    });
});
