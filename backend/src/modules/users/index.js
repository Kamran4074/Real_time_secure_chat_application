// Public API of the users module: other modules and server.js import from here only.
// (Never import routes / controllers here: that would create import cycles.)
export { default as User } from "./user.model.js";
export { defaultAvatar } from "./avatar.js";
export {
    findByEmail,
    isUsernameTaken,
    getHiddenUserIds,
    getBlockRelation,
    getPublicProfiles,
    saveLastSeen,
} from "./users.service.js";
