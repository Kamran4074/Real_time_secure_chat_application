// "last seen just now" / "today at 5:30 pm" / "yesterday at ..." / "12 Oct at ..."
export const lastSeenLabel = (date, now = new Date()) => {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    if (now - d < 60 * 1000) return 'last seen just now';

    const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return `last seen today at ${time}`;
    if (d.toDateString() === yesterday.toDateString()) return `last seen yesterday at ${time}`;
    const day = d.toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short',
        year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric'
    });
    return `last seen ${day} at ${time}`;
};
