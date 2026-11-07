import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import { allowedOrigins } from "./config/urls.js";
import logger, { errorMeta } from "./shared/logger.js";
import { AppError } from "./shared/errors.js";
import requestLogger from "./shared/middleware/requestLogger.js";
import tagModule from "./shared/middleware/tagModule.js";
import { notFound, errorHandler } from "./shared/middleware/errorHandler.js";
import * as auth from "./modules/auth/auth.routes.js";
import * as users from "./modules/users/users.routes.js";
import * as messages from "./modules/messages/messages.routes.js";

// Feature modules. Adding one = one import + one entry here; removing one = delete both.
const modules = [
    {name: 'auth', ...auth},
    {name: 'users', ...users},
    {name: 'messages', ...messages},
];

export const app = express();

// Render runs behind a proxy; needed so the rate limiter sees the real client IP
app.set('trust proxy', 1);

// first, so every request (even rejected ones) gets a request id, a log context and a log line
app.use(requestLogger);
app.use(helmet());
app.use(cors({
    origin(origin, callback){
        if(!origin || allowedOrigins.includes(origin)) callback(null, true);
        else callback(new AppError(403, 'CORS_ORIGIN_NOT_ALLOWED', 'Origin not allowed'));
    },
    credentials: true
}));
app.use(express.json({limit: '10kb'}));
app.use(cookieParser());

// every module: tag for logs, then its routes (each router starts with the shared apiLimiter)
for(const module of modules){
    app.use(`/api${module.basePath}`, tagModule(module.name), module.router);
}

app.get('/', (req, res)=>{
    res.send("Server is working");
});

// Health check for the scheduled ping: also touches MongoDB so the database counts as active
app.get('/api/health', async(req, res)=>{
    try {
        await mongoose.connection.db.admin().ping();
        res.status(200).send({status: "ok", db: "up", uptime: Math.round(process.uptime())});
    } catch (error) {
        logger.warn('Health check: database unreachable', errorMeta(error));
        res.status(503).send({status: "error", db: "down"});
    }
});

// must be last
app.use(notFound);
app.use(errorHandler);
