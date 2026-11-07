// What realtime needs from the business modules. Filled in by server.js (the composition root),
// so realtime/ never imports from modules/. Defaults keep realtime usable on its own.
const hooks = {
    // token -> {userId, jti}, or null if the token is invalid / logged out
    authenticate: async()=> null,
    // userId -> Set of user ids hidden from them (blocks in both directions)
    loadHiddenUserIds: async()=> new Set(),
    // first tab of a user connected (e.g. mark their waiting messages delivered)
    onUserOnline: async()=> {},
    // last tab of a user closed, after the grace period
    onUserOffline: async()=> {},
};

export const setHooks = (overrides)=> Object.assign(hooks, overrides);

export default hooks;
