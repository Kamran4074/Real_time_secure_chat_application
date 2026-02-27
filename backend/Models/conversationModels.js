import mongoose from "mongoose";

//we need participants id and message id in conversation
const conversationSchema = mongoose.Schema({

    //storing participant id
    participants:[
        {
            //it will take object id and that id came from User in userModel.js
            type:mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    ],
    //storing message id
    messages:{
        type:[{
            type:mongoose.Schema.Types.ObjectId,
            ref:'Message'
        }],
        default:[]  //if no message is there
    }
},{timestamps:true});

//creating model in data base 
const Conversation = mongoose.model('Conversation',conversationSchema);
//collection name will be ""conversations""" and it will take ref of conversationSchema

export default Conversation;