import Conversation from "../Models/conversationModels.js";
import Message from "../Models/messageScema.js";

export const sendMessage =async(req,res)=>{
    try {
        const {message} = req.body;
        const {id:recieversId}= req.params;
        const sendersId= req.user._id;

        let chats = await Conversation.findOne({
            participants:{$all:[sendersId,recieversId]}
        })

        if(!chats){
            chats = await Conversation.create({
                participants:[sendersId,recieversId],
            })
        }
        
        const newMessages = new Message({
            senderId: sendersId,
            recieverId: recieversId,
            message,
            conversationId:chats._id
        })

        if(newMessages){
            chats.messages.push(newMessages._id);
        }

        //Socket.IO function from here
        await Promise.all([chats.save(),newMessages.save()]);
        res.status(201).send(newMessages);
    } catch (error) {
        console.log('Error in sendMessage:', error);
        res.status(500).send({
            success: false,
            message: error.message || 'Message route controller error'
        });
    }
}