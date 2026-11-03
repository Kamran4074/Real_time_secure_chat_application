import User from "./user.model.js";
import { defaultAvatar } from "./avatar.js";
import escapeRegex from "../../shared/escapeRegex.js";
import { AppError, fieldError } from "../../shared/errors.js";
import logger from "../../shared/logger.js";
import { isUploadEnabled, signAvatarUpload, isOwnAvatarUrl } from "../../shared/services/cloudinary.js";
import { refreshBlocks } from "../../realtime/notifier.js";

// What other users may see about someone (never email, password, OAuth ids, ...)
const PUBLIC_FIELDS = "fullname username profilepic bio lastSeen";
const MIN_SEARCH_LENGTH = 2;
// case-insensitive exact match
const exactly = (value)=> ({$regex: `^${escapeRegex(value)}$`, $options: 'i'});

//----------------------
// lookups used by other modules
//----------------------
export const findByEmail = (email)=> User.findOne({email: exactly(email)});

export const isUsernameTaken = (username, exceptUserId)=> User.exists({
    username: exactly(username),
    ...(exceptUserId && {_id: {$ne: exceptUserId}})
});

// ids of users who blocked this user (they must not find or message them)
const blockedByIds = (userId)=> User.find({blockedUsers: userId}).distinct('_id');

// people this user blocked + people who blocked this user, as strings
export const getHiddenUserIds = async(userId)=>{
    const [me, blockers] = await Promise.all([
        User.findById(userId).select('blockedUsers'),
        blockedByIds(userId)
    ]);
    return new Set([...(me?.blockedUsers || []), ...blockers].map(String));
};

// null if the other user doesn't exist
export const getBlockRelation = async(meId, otherId)=>{
    const [me, other] = await Promise.all([
        User.findById(meId).select('blockedUsers'),
        User.findById(otherId).select('blockedUsers')
    ]);
    if(!other) return null;
    return {
        iBlocked: Boolean(me?.blockedUsers.some(id => id.equals(otherId))),
        blockedMe: other.blockedUsers.some(id => id.equals(meId))
    };
};

// Public profiles in the order of `ids` (missing users dropped). "Last seen" is hidden across a block.
export const getPublicProfiles = async(ids, viewerId)=>{
    const [users, hidden] = await Promise.all([
        User.find({_id: {$in: ids}}).select(PUBLIC_FIELDS),
        getHiddenUserIds(viewerId)
    ]);
    return ids
        .map(id => users.find(u => u._id.toString() === id.toString()))
        .filter(Boolean)
        .map(u => hidden.has(u._id.toString()) ? {...u.toObject(), lastSeen: undefined} : u);
};

export const saveLastSeen = (userId, lastSeen)=> User.updateOne({_id: userId}, {lastSeen});

//----------------------
// search
//----------------------
export const searchUsers = async(viewerId, search)=>{
    // too short to be useful, and must not list every user
    if(search.length < MIN_SEARCH_LENGTH) return [];
    const pattern = escapeRegex(search);
    return User.find({
        $and: [
            {
                // username starts with it, or any word of the full name does ("joh" finds "Alice Johnson")
                $or: [
                    {username: {$regex: `^${pattern}`, $options: 'i'}},
                    {fullname: {$regex: `(^|\\s)${pattern}`, $options: 'i'}}
                ]
            },
            // not yourself, and not people who blocked you
            {_id: {$nin: [viewerId, ...await blockedByIds(viewerId)]}}
        ]
    }).select(PUBLIC_FIELDS).limit(20);
};

//----------------------
// your own profile
//----------------------
const ownProfile = (user)=> ({
    _id: user._id,
    fullname: user.fullname,
    username: user.username,
    email: user.email,
    profilepic: user.profilepic,
    bio: user.bio || "",
    canUploadPhoto: isUploadEnabled(),
    linkedAccounts: {google: Boolean(user.googleId), github: Boolean(user.githubId)}
});

export const getMe = async(user)=>{
    // the session user is loaded without the password; only whether one exists is needed
    const hasPassword = Boolean((await User.findById(user._id).select('password'))?.password);
    return {...ownProfile(user), hasPassword};
};

const usernameTaken = ()=> fieldError(400, 'USERS_USERNAME_TAKEN', 'username', "Username already taken");

// changes: validated by updateProfileSchema (fullname, username, bio, profilepic; each optional)
export const updateProfile = async(user, changes)=>{
    const {fullname, username, bio, profilepic} = changes;

    if(username !== undefined && username.toLowerCase() !== user.username.toLowerCase()
        && await isUsernameTaken(username, user._id)){
        throw usernameTaken();
    }
    // a photo URL must point to this user's own upload, so nobody can set an arbitrary image / tracking pixel
    if(profilepic && !isOwnAvatarUrl(profilepic, user._id)){
        throw new AppError(400, 'USERS_INVALID_PHOTO', "Invalid photo");
    }

    if(fullname !== undefined) user.fullname = fullname;
    if(username !== undefined) user.username = username;
    if(bio !== undefined) user.bio = bio;
    if(profilepic !== undefined) user.profilepic = profilepic || defaultAvatar(user.username);

    try {
        await user.save();
    } catch (error) {
        // someone took the same username at the same moment
        if(error.code === 11000) throw usernameTaken();
        throw error;
    }
    logger.info('Profile updated', {userId: user._id.toString(), fields: Object.keys(changes)});
    return ownProfile(user);
};

// Signed parameters for uploading the profile photo directly to Cloudinary
export const getAvatarUploadSignature = (userId)=>{
    if(!isUploadEnabled()){
        throw new AppError(503, 'USERS_UPLOAD_UNAVAILABLE', "Photo upload is not available right now");
    }
    return signAvatarUpload(userId);
};

//----------------------
// blocking
//----------------------
export const getBlockedUsers = async(user)=>{
    await user.populate({path: 'blockedUsers', select: PUBLIC_FIELDS});
    return user.blockedUsers;
};

export const blockUser = async(meId, otherId)=>{
    if(otherId === meId.toString()){
        throw new AppError(400, 'USERS_CANNOT_BLOCK_SELF', "You can't block yourself");
    }
    if(!(await User.exists({_id: otherId}))){
        throw new AppError(404, 'USERS_NOT_FOUND', "User not found");
    }
    await User.updateOne({_id: meId}, {$addToSet: {blockedUsers: otherId}});
    // hide online status / typing between the two right away
    await refreshBlocks(meId, otherId);
    logger.info('User blocked', {userId: meId.toString(), blockedId: otherId});
};

export const unblockUser = async(meId, otherId)=>{
    await User.updateOne({_id: meId}, {$pull: {blockedUsers: otherId}});
    await refreshBlocks(meId, otherId);
    logger.info('User unblocked', {userId: meId.toString(), blockedId: otherId});
};
