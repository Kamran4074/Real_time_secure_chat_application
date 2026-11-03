import * as messages from "./messages.service.js";

// HTTP in / out only: the rules live in messages.service.js

export const getRecentChats = async(req, res)=>{
    res.status(200).send(await messages.getRecentChats(req.user._id));
};

export const sendMessage = async(req, res)=>{
    const message = await messages.sendMessage(req.user._id, req.valid.params.id, req.body.messages);
    res.status(201).send(message);
};

export const getMessages = async(req, res)=>{
    res.status(200).send(await messages.getMessages(req.user._id, req.valid.params.id, req.valid.query));
};

export const markSeen = async(req, res)=>{
    const seen = await messages.markSeen(req.user._id, req.valid.params.id);
    res.status(200).send({success: true, seen});
};
