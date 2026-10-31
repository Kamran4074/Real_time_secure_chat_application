import Conversation from "../models/conversationModel.js";
import User from "../models/userModel.js";
import escapeRegex from "../utils/escapeRegex.js";

// req.valid.query.search is already a trimmed string of max 50 chars (searchQuery schema)
export const getUserBySearch = async(req,res)=>{
    const {search} = req.valid.query;
    // don't let an empty search list every user
    if(!search) return res.status(200).send([]);

    const pattern = escapeRegex(search);
    const currentUserID = req.user._id;
    const user = await User.find({
        $and:[
            {
                // match username or full name
                $or:[
                    {username:{$regex:pattern ,$options:'i'}},
                    {fullname:{$regex:pattern,$options:'i'}}
                ]
            },{
                _id:{$ne:currentUserID} // exclude yourself
            }
        ]
    }).select("-password -email").limit(20);

    res.status(200).send(user);
}

export const getCurrentChatters = async(req,res)=>{
    const currentUserID = req.user._id.toString();

    const currentChatters = await Conversation.find({
        participants: currentUserID
    }).sort({ // most recent chat first
        updatedAt: -1
    });

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
}
