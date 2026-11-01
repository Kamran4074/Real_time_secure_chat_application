import Conversation from "../models/conversationModel.js";
import Message from "../models/messageModel.js";
import User from "../models/userModel.js";
import { emitToUser, isOnline } from "../socket/socket.js";

// :id is a valid ObjectId and messages is a trimmed 1-2000 char string (see routes/messageRoutes.js)
export const sendMessage =async(req,res)=>{
    const {messages} = req.body;
    const {id:receiverId} = req.valid.params;
    const senderId = req.user._id;

    if(receiverId === senderId.toString()){
        return res.status(400).send({success:false, message:"You can't message yourself"});
    }
    const receiver = await User.findById(receiverId).select('blockedUsers');
    if(!receiver){
        return res.status(404).send({success:false, message:"Receiver not found"});
    }
    if(req.user.blockedUsers.some(id => id.equals(receiverId))){
        return res.status(403).send({success:false, message:"Unblock this user to send a message"});
    }
    // generic message, so it's not obvious that they blocked you
    if(receiver.blockedUsers.some(id => id.equals(senderId))){
        return res.status(403).send({success:false, message:"You can't message this user"});
    }

    let chats = await Conversation.findOne({
        participants:{$all:[senderId , receiverId]}
    })

    if(!chats){
        chats = await Conversation.create({
            participants:[senderId , receiverId],
        })
    }

    const newMessages = new Message({
        senderId,
        recieverId: receiverId,
        message: messages,
        conversationId: chats._id,
        // receiver has a tab open: the socket push below reaches them now (✓✓)
        deliveredAt: isOnline(receiverId) ? new Date() : null
    })

    chats.updatedAt = new Date(); // moves this chat to the top of "recent chats"

    await Promise.all([chats.save(),newMessages.save()]);

    // real-time delivery to every open tab of the receiver
    emitToUser(receiverId, "newMessage", newMessages);

    res.status(201).send(newMessages)
}


// One page of the chat, oldest first. ?before=<message id> loads the page before it (scrolling up).
// A page shorter than `limit` means there is nothing older.
export const getMessages=async(req,res)=>{
    const {id:receiverId} = req.valid.params;
    const {before, limit} = req.valid.query;
    const senderId = req.user._id;

    const chats = await Conversation.findOne({
        participants:{$all:[senderId , receiverId]}
    }).select('_id');

    if(!chats)  return res.status(200).send([]);

    // cursor (not skip): stays fast and correct even while new messages arrive
    const page = await Message.find({
        conversationId: chats._id,
        ...(before && {_id: {$lt: before}})
    }).sort({_id: -1}).limit(limit);

    res.status(200).send(page.reverse())
}

// Receiver opened the chat: everything this sender sent them is seen (and so delivered too)
export const markSeen = async(req,res)=>{
    const {id:senderId} = req.valid.params;
    const receiverId = req.user._id;
    const at = new Date();

    const unseen = {senderId, recieverId: receiverId, seenAt: null};
    // seen implies delivered (keeps any earlier delivery time)
    await Message.updateMany({...unseen, deliveredAt: null}, {deliveredAt: at});
    const result = await Message.updateMany(unseen, {seenAt: at});
    // turn the sender's ticks blue, live
    if(result.modifiedCount > 0){
        emitToUser(senderId, 'messagesSeen', {receiverId: receiverId.toString(), at});
    }
    res.status(200).send({success: true, seen: result.modifiedCount});
}
