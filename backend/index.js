import 'dotenv/config' // must be first so env is loaded before anything reads it
import mongoose from "mongoose";
import { loadEnv } from "./config/env.js";
import logger, { errorMeta } from "./utils/logger.js";
import dbConnect from "./DB/dbConnect.js";
import {server} from './app.js'
import {io} from './socket/socket.js'

// exits with a clear message if a required variable is missing or malformed
const env = loadEnv();

process.on('unhandledRejection', (reason)=>{
    logger.error('Unhandled promise rejection', errorMeta(reason));
});
process.on('uncaughtException', (err)=>{
    logger.error('Uncaught exception, shutting down', errorMeta(err));
    process.exit(1);
});

// Render / Docker send SIGTERM on deploy: finish in-flight requests, then close the DB
const shutdown = (signal)=>{
    logger.info(`${signal} received, shutting down`);
    // closes all sockets and the underlying http server
    io.close(async()=>{
        await mongoose.disconnect();
        logger.info('Shutdown complete');
        process.exit(0);
    });
    setTimeout(()=> process.exit(1), 10000).unref();
};
process.on('SIGTERM', ()=> shutdown('SIGTERM'));
process.on('SIGINT', ()=> shutdown('SIGINT'));

// Connect to the database before accepting requests
await dbConnect();
server.listen(env.PORT,()=>{
    logger.info(`Server listening on port ${env.PORT}`, {env: env.NODE_ENV || 'development'});
})
