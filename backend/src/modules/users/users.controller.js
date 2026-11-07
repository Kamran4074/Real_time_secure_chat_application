import * as users from "./users.service.js";

// HTTP in / out only: the rules live in users.service.js

export const search = async(req, res)=>{
    res.status(200).send(await users.searchUsers(req.user._id, req.valid.query.search));
};

export const getMe = async(req, res)=>{
    res.status(200).send(await users.getMe(req.user));
};

export const updateMe = async(req, res)=>{
    res.status(200).send(await users.updateProfile(req.user, req.body));
};

export const getAvatarUploadSignature = (req, res)=>{
    res.status(200).send(users.getAvatarUploadSignature(req.user._id));
};

export const getBlockedUsers = async(req, res)=>{
    res.status(200).send(await users.getBlockedUsers(req.user));
};

export const blockUser = async(req, res)=>{
    await users.blockUser(req.user._id, req.valid.params.id);
    res.status(200).send({success:true, message:"User blocked"});
};

export const unblockUser = async(req, res)=>{
    await users.unblockUser(req.user._id, req.valid.params.id);
    res.status(200).send({success:true, message:"User unblocked"});
};
