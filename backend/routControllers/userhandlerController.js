import Conversation from "../Models/conversationModels.js";
import User from "../Models/userModels.js";
import escapeRegex from "../utils/escapeRegex.js";

export const getUserBySearch = async(req,res)=>{
    try {
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        // don't let an empty search list every user
        if(!search) return res.status(200).send([]);
        if(search.length > 50) return res.status(400).send({success:false, message:"Search is too long"});

        const pattern = escapeRegex(search);
        const currentUserID = req.user._id;
        const user = await User.find({
            $and:[
                {
                    //it will search and show any thing either username or fullname
                    $or:[
                        {username:{$regex:pattern ,$options:'i'}},
                        {fullname:{$regex:pattern,$options:'i'}}
                    ]
                },{
                    _id:{$ne:currentUserID} //khud ka username nahi aayega
                }
            ]
        }).select("-password -email").limit(20);

        res.status(200).send(user); //search function created

    } catch (error) {
        console.log('Error details:', error);
        res.status(500).send({success:false, message:'Internal server error'})
    }
}

export const getCurrentChatters = async(req,res)=>{
    try {
        const currentUserID = req.user._id.toString(); //get id

        const currentChatters = await Conversation.find({
            participants: currentUserID
        }).sort({                           // sort id on the basis of recent chats
            updatedAt: -1
        });

        //if no conversation send empty array
        if(currentChatters.length === 0) return res.status(200).send([]);

        const otherParticipantsIDS = currentChatters
            .flatMap(c => c.participants)
            .filter(id => id.toString() !== currentUserID);

        const user = await User.find({_id:{$in:otherParticipantsIDS}}).select("-password -email");

        // keep recent-chat order and drop users that no longer exist
        const users = otherParticipantsIDS
            .map(id => user.find(u => u._id.toString() === id.toString()))
            .filter(Boolean);

        res.status(200).send(users)

    } catch (error) {
        console.log('Error details:', error);
        res.status(500).send({success:false, message:'Internal server error'})
    }
}
