import mongoose from "mongoose";

// A one-on-one chat between two users
const conversationSchema = mongoose.Schema({
    participants:[
        {
            type:mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    ],
    messages:{
        type:[{
            type:mongoose.Schema.Types.ObjectId,
            ref:'Message'
        }],
        default:[]
    }
},{timestamps:true});

const Conversation = mongoose.model('Conversation',conversationSchema);

export default Conversation;
