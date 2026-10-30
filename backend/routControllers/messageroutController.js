import mongoose from "mongoose";
import Conversation from "../Models/conversationModels.js";
import Message from "../Models/messageScema.js";
import User from "../Models/userModels.js";
import { emitToUser } from "../socket/socket.js";

const MAX_MESSAGE_LENGTH = 2000;

export const sendMessage =async(req,res)=>{
try {
    const {messages} = req.body;
    const {id:receiverId} = req.params;
    const senderId = req.user._id;

    if(!mongoose.Types.ObjectId.isValid(receiverId)){
        return res.status(400).send({success:false, message:"Invalid receiver"});
    }
    if(receiverId === senderId.toString()){
        return res.status(400).send({success:false, message:"You can't message yourself"});
    }
    if(typeof messages !== 'string' || !messages.trim()){
        return res.status(400).send({success:false, message:"Message can't be empty"});
    }
    if(messages.length > MAX_MESSAGE_LENGTH){
        return res.status(400).send({success:false, message:`Message must be under ${MAX_MESSAGE_LENGTH} characters`});
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
        message: messages.trim(),
        conversationId: chats._id
    })

    chats.messages.push(newMessages._id);

    await Promise.all([chats.save(),newMessages.save()]);

     //SOCKET.IO function (reaches every open tab of the receiver)
     emitToUser(receiverId, "newMessage", newMessages);

    res.status(201).send(newMessages)

} catch (error) {
    console.log(`error in sendMessage ${error}`);
    res.status(500).send({success: false, message: "Internal server error"})
}
}


export const getMessages=async(req,res)=>{
try {
    const {id:receiverId} = req.params;
    const senderId = req.user._id;

    if(!mongoose.Types.ObjectId.isValid(receiverId)){
        return res.status(400).send({success:false, message:"Invalid user"});
    }

    const chats = await Conversation.findOne({
        participants:{$all:[senderId , receiverId]}
    }).populate("messages")

    if(!chats)  return res.status(200).send([]);
    const message = chats.messages;
    res.status(200).send(message)
} catch (error) {
    console.log(`error in getMessage ${error}`);
    res.status(500).send({success: false, message: "Internal server error"})
}
}
