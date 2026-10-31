import mongoose from "mongoose";
import logger, { errorMeta } from "../utils/logger.js";

mongoose.connection.on('disconnected', ()=> logger.warn('MongoDB disconnected'));
mongoose.connection.on('reconnected', ()=> logger.info('MongoDB reconnected'));

const dbConnect = async()=>{
    try {
        await mongoose.connect(process.env.MONGODB_CONNECT);
        logger.info("MongoDB connected");
    } catch (error) {
        logger.error("MongoDB connection failed", errorMeta(error));
        process.exit(1); // no point serving requests without a database
    }
}

export default dbConnect;
