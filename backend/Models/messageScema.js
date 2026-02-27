import mongoose from "mongoose";

//we need sender id reciever id and messages in message schema
const messageSchema = mongoose.Schema({
    senderId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    recieverId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    message:{
        type:String,
        required:true
    },
    conversationId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Conversation",
        default:[]
    }
},{timestamps:true});

const Message = mongoose.model('Message',messageSchema);
export default Message;