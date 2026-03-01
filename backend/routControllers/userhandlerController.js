import Conversation from "../Models/conversationModels.js";
import User from "../Models/userModels.js";

export const getUserBySearch = async(req,res)=>{
    try {
        const search = req.query.search || '';
        const currentUserID = req.user._id;
        const user = await User.find({
            $and:[
                {
                    $or:[
                        //it will search and show any thing either username or fullname 
                        {username:{$regex:search ,$options:'i'}},
                        // Matches "john" in "myjohn", "john123", "superjohn"

                        {fullname:{$regex:'.*'+search,$options:'i'}}
                        /* Matches: '.*'
                        - "john" ✓
                        - "John" ✓
                        - "JOHN" ✓
                        - "john123" ✓
                        - "myjohn" ✓
                        - "superjohn" ✓

                        // Doesn't match:
                        - "joe" ✗
                        - "jane" ✗ */
                    ]
                },{
                    _id:{$ne:currentUserID} //khud ka username nahi aayega
                }
            ]
        }).select("-password").select("-email");

        res.status(200).send(user); //search function created

    } catch (error) {
        console.log('Error details:', error);
        res.status(500).send({
            success:false,
            message: error.message || 'Internal server error',
        })
    }
}

export const getCurrentChatters = async(req,res)=>{
    try {
        const currentUserID = req.user._id; //get id
        
        const currentChatters = await Conversation.find({
            participants: { $in: [currentUserID] }
        }).sort({                           // sort id on the basis of recent chats 
            updatedAt: -1
        });

        //if no conversation send empty array
        if(!currentChatters || currentChatters.length === 0) return res.status(200).send([]);

        const participantIDS = currentChatters.reduce((ids,Conversation)=>{
            const otherParticipantsIDS = Conversation.participants.filter(id => id!== currentUserID)
            return [...ids,...otherParticipantsIDS]
        }, [])
        
        const otherParticipantsIDS = participantIDS.filter(id => id.toString() !== currentUserID.toString());

        const user = await User.find({_id:{$in:otherParticipantsIDS}}).select("-password").select("-email");

        const users = otherParticipantsIDS.map(id => user.find(u => u._id.toString()=== id.toString()));

        res.status(200).send(users)

    } catch (error) {
        console.log('Error details:', error);
        res.status(500).send({
            success:false,
            message: error.message || 'Internal server error',
        })
    }
}