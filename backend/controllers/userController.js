import Conversation from "../models/conversationModel.js";
import User from "../models/userModel.js";
import escapeRegex from "../utils/escapeRegex.js";
import { defaultAvatar } from "../utils/avatar.js";
import { isUploadEnabled, signAvatarUpload, isOwnAvatarUrl } from "../utils/cloudinary.js";
import logger from "../utils/logger.js";
import { refreshBlocks } from "../socket/socket.js";

// What other users may see about someone (never email, password, OAuth ids, ...)
const PUBLIC_FIELDS = "fullname username profilepic bio";

// What you see about yourself
const ownProfile = (user)=> ({
    _id:user._id,
    fullname:user.fullname,
    username:user.username,
    email:user.email,
    profilepic:user.profilepic,
    bio:user.bio || "",
    canUploadPhoto:isUploadEnabled(),
    linkedAccounts:{google:Boolean(user.googleId), github:Boolean(user.githubId)}
});

// ids of users who blocked this user (they must not find or message them)
const blockedBy = (userId)=> User.find({blockedUsers:userId}).distinct('_id');

const MIN_SEARCH_LENGTH = 2;

// req.valid.query.search is already a trimmed string of max 50 chars (searchQuery schema)
export const getUserBySearch = async(req,res)=>{
    const {search} = req.valid.query;
    // too short to be useful, and must not list every user
    if(search.length < MIN_SEARCH_LENGTH) return res.status(200).send([]);

    const pattern = escapeRegex(search);
    const currentUserID = req.user._id;
    const user = await User.find({
        $and:[
            {
                // username starts with it, or any word of the full name does ("joh" finds "Alice Johnson")
                $or:[
                    {username:{$regex:`^${pattern}`, $options:'i'}},
                    {fullname:{$regex:`(^|\\s)${pattern}`, $options:'i'}}
                ]
            },{
                // not yourself, and not people who blocked you
                _id:{$nin:[currentUserID, ...await blockedBy(currentUserID)]}
            }
        ]
    }).select(PUBLIC_FIELDS).limit(20);

    res.status(200).send(user);
}

export const getCurrentChatters = async(req,res)=>{
    const currentUserID = req.user._id.toString();

    const currentChatters = await Conversation.find({
        participants: currentUserID
    }).sort({ // most recent chat first
        updatedAt: -1
    });

    if(currentChatters.length === 0) return res.status(200).send([]);

    const otherParticipantsIDS = currentChatters
        .flatMap(c => c.participants)
        .filter(id => id.toString() !== currentUserID);

    const user = await User.find({_id:{$in:otherParticipantsIDS}}).select(PUBLIC_FIELDS);

    // keep recent-chat order and drop users that no longer exist
    const users = otherParticipantsIDS
        .map(id => user.find(u => u._id.toString() === id.toString()))
        .filter(Boolean);

    res.status(200).send(users)
}

//----------------------
// your own profile
//----------------------
export const getMe = async(req,res)=>{
    // isLogin leaves the password out; only whether one exists is needed (Google / GitHub accounts may have none)
    const hasPassword = Boolean((await User.findById(req.user._id).select('password'))?.password);
    res.status(200).send({...ownProfile(req.user), hasPassword});
}

// body validated by updateProfileSchema: only fullname, username, bio, profilepic, each optional
export const updateMe = async(req,res)=>{
    const {fullname, username, bio, profilepic} = req.body;
    const user = req.user;

    if(username !== undefined && username.toLowerCase() !== user.username.toLowerCase()){
        const taken = await User.exists({
            username:{$regex:`^${escapeRegex(username)}$`, $options:'i'},
            _id:{$ne:user._id}
        });
        if(taken) return res.status(400).send({success:false, message:"Username already taken", errors:[{field:'username', message:"Username already taken"}]});
    }
    // a photo URL must point to this user's own upload, so nobody can set an arbitrary image / tracking pixel
    if(profilepic && !isOwnAvatarUrl(profilepic, user._id)){
        return res.status(400).send({success:false, message:"Invalid photo"});
    }

    if(fullname !== undefined) user.fullname = fullname;
    if(username !== undefined) user.username = username;
    if(bio !== undefined) user.bio = bio;
    if(profilepic !== undefined) user.profilepic = profilepic || defaultAvatar(user.username);

    try {
        await user.save();
    } catch (error) {
        // someone took the same username at the same moment
        if(error.code === 11000){
            return res.status(400).send({success:false, message:"Username already taken", errors:[{field:'username', message:"Username already taken"}]});
        }
        throw error;
    }
    logger.info('Profile updated', {requestId:req.id, userId:user._id.toString(), fields:Object.keys(req.body)});
    res.status(200).send(ownProfile(user));
}

// Signed parameters for uploading the profile photo directly to Cloudinary
export const getAvatarUploadSignature = async(req,res)=>{
    if(!isUploadEnabled()){
        return res.status(503).send({success:false, message:"Photo upload is not available right now"});
    }
    res.status(200).send(signAvatarUpload(req.user._id));
}

//----------------------
// blocking
//----------------------
export const getBlockedUsers = async(req,res)=>{
    await req.user.populate({path:'blockedUsers', select:PUBLIC_FIELDS});
    res.status(200).send(req.user.blockedUsers);
}

export const blockUser = async(req,res)=>{
    const {id} = req.valid.params;
    if(id === req.user._id.toString()){
        return res.status(400).send({success:false, message:"You can't block yourself"});
    }
    if(!(await User.exists({_id:id}))){
        return res.status(404).send({success:false, message:"User not found"});
    }
    await User.updateOne({_id:req.user._id}, {$addToSet:{blockedUsers:id}});
    // hide online status / typing between the two right away
    await refreshBlocks(req.user._id, id);
    logger.info('User blocked', {requestId:req.id, userId:req.user._id.toString(), blockedId:id});
    res.status(200).send({success:true, message:"User blocked"});
}

export const unblockUser = async(req,res)=>{
    const {id} = req.valid.params;
    await User.updateOne({_id:req.user._id}, {$pull:{blockedUsers:id}});
    await refreshBlocks(req.user._id, id);
    logger.info('User unblocked', {requestId:req.id, userId:req.user._id.toString(), blockedId:id});
    res.status(200).send({success:true, message:"User unblocked"});
}
