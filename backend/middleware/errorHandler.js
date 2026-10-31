import logger, { errorMeta } from '../utils/logger.js';

// Error with an HTTP status that is safe to show to the client
export class HttpError extends Error {
    constructor(status, message){
        super(message);
        this.status = status;
        this.expose = true;
    }
}

export const notFound = (req, res)=>{
    res.status(404).send({success:false, message:"Route not found"});
};

// Last middleware: every thrown / rejected error ends up here (Express 5 forwards async errors)
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next)=>{
    if(res.headersSent) return next(err);

    if(err.type === 'entity.parse.failed'){
        return res.status(400).send({success:false, message:"Invalid JSON body"});
    }
    if(err.type === 'entity.too.large'){
        return res.status(413).send({success:false, message:"Request body too large"});
    }
    if(err.status && err.status < 500){
        return res.status(err.status).send({success:false, message: err.expose ? err.message : "Bad request"});
    }

    logger.error(`Unhandled error on ${req.method} ${req.originalUrl.split('?')[0]}`, {
        requestId: req.id,
        ...errorMeta(err)
    });
    // the request id lets a user report an error that we can find in the logs
    res.status(500).send({success:false, message:"Internal server error", requestId: req.id});
};
