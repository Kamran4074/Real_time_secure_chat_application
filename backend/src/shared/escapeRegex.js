// Escape user input so it is matched literally inside a RegExp (prevents ReDoS / pattern injection)
const escapeRegex = (str)=> String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default escapeRegex;
