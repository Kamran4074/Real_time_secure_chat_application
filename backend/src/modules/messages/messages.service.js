import Conversation from "./conversation.model.js";
import Message from "./message.model.js";
import { getBlockRelation, getPublicProfiles } from "../users/index.js";
import { AppError } from "../../shared/errors.js";
import { emitToUser, isOnline } from "../../realtime/notifier.js";

const findConversation = (userA, userB)=> Conversation.findOne({participants: {$all: [userA, userB]}});

//----------------------
// recent chats: the other participant of each conversation, most recent first
//----------------------
export const getRecentChats = async(userId)=>{
    const conversations = await Conversation.find({participants: userId}).sort({updatedAt: -1});
    const partnerIds = conversations
        .flatMap(c => c.participants)
        .filter(id => id.toString() !== userId.toString());
    if(partnerIds.length === 0) return [];
    return getPublicProfiles(partnerIds, userId);
};

//----------------------
// send
//----------------------
// text: a trimmed 1-2000 char string (sendMessageSchema)
export const sendMessage = async(senderId, receiverId, text)=>{
    if(receiverId === senderId.toString()){
        throw new AppError(400, 'MESSAGES_CANNOT_MESSAGE_SELF', "You can't message yourself");
    }
    const relation = await getBlockRelation(senderId, receiverId);
    if(!relation){
        throw new AppError(404, 'MESSAGES_RECEIVER_NOT_FOUND', "Receiver not found");
    }
    if(relation.iBlocked){
        throw new AppError(403, 'MESSAGES_RECEIVER_BLOCKED', "Unblock this user to send a message");
    }
    // generic message, so it's not obvious that they blocked you
    if(relation.blockedMe){
        throw new AppError(403, 'MESSAGES_NOT_ALLOWED', "You can't message this user");
    }

    const conversation = await findConversation(senderId, receiverId)
        ?? await Conversation.create({participants: [senderId, receiverId]});

    const message = new Message({
        senderId,
        recieverId: receiverId,
        message: text,
        conversationId: conversation._id,
        // receiver has a tab open: the socket push below reaches them now (✓✓)
        deliveredAt: isOnline(receiverId) ? new Date() : null
    });
    conversation.updatedAt = new Date(); // moves this chat to the top of "recent chats"
    await Promise.all([conversation.save(), message.save()]);

    // real-time delivery to every open tab of the receiver
    emitToUser(receiverId, "newMessage", message);
    return message;
};

//----------------------
// history
//----------------------
// One page of the chat, oldest first. `before` (a message id) loads the page before it (scrolling up).
// A page shorter than `limit` means there is nothing older.
export const getMessages = async(userId, otherId, {before, limit})=>{
    const conversation = await findConversation(userId, otherId).select('_id');
    if(!conversation) return [];

    // cursor (not skip): stays fast and correct even while new messages arrive
    const page = await Message.find({
        conversationId: conversation._id,
        ...(before && {_id: {$lt: before}})
    }).sort({_id: -1}).limit(limit);
    return page.reverse();
};

//----------------------
// read receipts
//----------------------
// Receiver opened the chat: everything this sender sent them is seen (and so delivered too)
export const markSeen = async(receiverId, senderId)=>{
    const at = new Date();
    const unseen = {senderId, recieverId: receiverId, seenAt: null};
    // seen implies delivered (keeps any earlier delivery time)
    await Message.updateMany({...unseen, deliveredAt: null}, {deliveredAt: at});
    const result = await Message.updateMany(unseen, {seenAt: at});
    // turn the sender's ticks blue, live
    if(result.modifiedCount > 0){
        emitToUser(senderId, 'messagesSeen', {receiverId: receiverId.toString(), at});
    }
    return result.modifiedCount;
};

// A user just connected: messages that waited for them are now delivered; tell each sender (✓ -> ✓✓)
export const markDelivered = async(userId)=>{
    const senders = await Message.find({recieverId: userId, deliveredAt: null}).distinct('senderId');
    if(senders.length === 0) return;
    const at = new Date();
    await Message.updateMany({recieverId: userId, deliveredAt: null}, {deliveredAt: at});
    senders.forEach(senderId => emitToUser(senderId, 'messagesDelivered', {receiverId: userId, at}));
};
