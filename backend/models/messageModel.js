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
    },
    // read receipts: reached a device of the receiver (✓✓) / receiver opened the chat (blue ✓✓)
    deliveredAt:{
        type:Date,
        default:null
    },
    seenAt:{
        type:Date,
        default:null
    }
},{timestamps:true});

// a page of one chat: newest first, older pages with _id < cursor
messageSchema.index({conversationId:1, _id:-1});
// "everything not yet delivered / seen for this receiver"
messageSchema.index({recieverId:1, deliveredAt:1});
messageSchema.index({recieverId:1, senderId:1, seenAt:1});

const Message = mongoose.model('Message',messageSchema);
export default Message;