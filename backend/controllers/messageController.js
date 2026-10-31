import Conversation from "../models/conversationModel.js";
import Message from "../models/messageModel.js";
import User from "../models/userModel.js";
import { emitToUser } from "../socket/socket.js";

// :id is a valid ObjectId and messages is a trimmed 1-2000 char string (see routes/messageRoutes.js)
export const sendMessage =async(req,res)=>{
    const {messages} = req.body;
    const {id:receiverId} = req.valid.params;
    const senderId = req.user._id;

    if(receiverId === senderId.toString()){
        return res.status(400).send({success:false, message:"You can't message yourself"});
    }
    if(!(await User.exists({_id:receiverId}))){
        return res.status(404).send({success:false, message:"Receiver not found"});
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
        conversationId: chats._id
    })

    chats.messages.push(newMessages._id);

    await Promise.all([chats.save(),newMessages.save()]);

    // real-time delivery to every open tab of the receiver
    emitToUser(receiverId, "newMessage", newMessages);

    res.status(201).send(newMessages)
}


export const getMessages=async(req,res)=>{
    const {id:receiverId} = req.valid.params;
    const senderId = req.user._id;

    const chats = await Conversation.findOne({
        participants:{$all:[senderId , receiverId]}
    }).populate("messages")

    if(!chats)  return res.status(200).send([]);
    res.status(200).send(chats.messages)
}
