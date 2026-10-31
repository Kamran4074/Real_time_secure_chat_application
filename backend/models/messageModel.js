import mongoose from "mongoose";

// note: the field is spelled "recieverId" in the database; kept for existing data
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
        required:true,
        maxlength:2000
    },
    conversationId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Conversation"
    }
},{timestamps:true});

const Message = mongoose.model('Message',messageSchema);
export default Message;