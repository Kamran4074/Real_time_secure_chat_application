import mongoose from "mongoose";

// A one-on-one chat between two users
const conversationSchema = mongoose.Schema({
    participants:[
        {
            type:mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    ],
    // legacy: no longer written. Messages are found by their conversationId (indexed, paginated),
    // because an ever-growing array would eventually hit MongoDB's 16 MB document limit.
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
