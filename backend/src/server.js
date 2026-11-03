import http from "http";
import { app } from "./app.js";
import { setupRealtime } from "./realtime/index.js";
import { authenticateSocketToken } from "./modules/auth/index.js";
import { getHiddenUserIds, saveLastSeen } from "./modules/users/index.js";
import { markDelivered } from "./modules/messages/index.js";

// Composition root: the only file that connects the HTTP app, Socket.IO and the business modules.
// No side effects beyond creating objects: index.js (or a test) decides when to listen.

export const server = http.createServer(app);

export const io = setupRealtime(server, {
    authenticate: authenticateSocketToken,
    loadHiddenUserIds: getHiddenUserIds,
    onUserOnline: markDelivered,
    onUserOffline: saveLastSeen,
});

export { app };
