import mongoose from "mongoose";

const dbConnect = async()=>{
    try {
        await mongoose.connect(process.env.MONGODB_CONNECT);
        console.log("MongoDB connected");
    } catch (error) {
        console.log(error);
        process.exit(1); // no point serving requests without a database
    }
}

export default dbConnect;
