import api from '../../shared/api/client';

// Every call to the backend's messages module (/api/message)

export const PAGE_SIZE = 30; // the backend's default page; a shorter page means nothing older

// newest page, or the page before message `before` (scrolling up)
export const getMessages = (otherId, before) => (before
    ? api.get(`/api/message/${otherId}`, { params: { before } })
    : api.get(`/api/message/${otherId}`)
).then((r) => r.data);

export const sendMessage = (otherId, text) => api.post(`/api/message/send/${otherId}`, { messages: text }).then((r) => r.data);

export const markSeen = (otherId) => api.post(`/api/message/seen/${otherId}`);
