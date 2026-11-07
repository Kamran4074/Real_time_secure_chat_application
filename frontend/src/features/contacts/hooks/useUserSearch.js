import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { errorMessage } from '../../../shared/api/client';
import { searchUsers } from '../api';

const MIN_SEARCH = 2;        // same as the backend
const SEARCH_DELAY_MS = 300; // search once typing pauses
// "@kamran" and "kamran" search the same
const toQuery = (input) => input.trim().replace(/^@/, '');

// Search-as-you-type for people. results is null while not searching (show the chats instead).
const useUserSearch = () => {
    const [input, setInput] = useState('');
    const [results, setResults] = useState(null);
    const [searching, setSearching] = useState(false);
    const latestSearch = useRef('');

    // only the latest query's answer is used
    const runSearch = useCallback(async (query) => {
        latestSearch.current = query;
        setSearching(true);
        try {
            const users = await searchUsers(query);
            if (latestSearch.current === query) setResults(users);
        } catch (error) {
            if (latestSearch.current === query) toast.error(errorMessage(error, 'Search failed'));
        } finally {
            if (latestSearch.current === query) setSearching(false);
        }
    }, []);

    // once typing pauses; clearing the box goes back to the chats
    useEffect(() => {
        const query = toQuery(input);
        if (query.length < MIN_SEARCH) {
            latestSearch.current = '';
            setSearching(false);
            if (!query) setResults(null);
            return;
        }
        const timer = setTimeout(() => runSearch(query), SEARCH_DELAY_MS);
        return () => clearTimeout(timer);
    }, [input, runSearch]);

    // Enter searches right away
    const searchNow = () => {
        const query = toQuery(input);
        if (query.length >= MIN_SEARCH) runSearch(query);
    };

    const clear = () => {
        setResults(null);
        setInput('');
    };

    return { input, setInput, results, searching, searchNow, clear };
};

export default useUserSearch;
