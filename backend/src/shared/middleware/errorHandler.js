import logger, { errorMeta } from '../logger.js';
import { AppError } from '../errors.js';

export const notFound = (req, res)=>{
    res.status(404).send({success:false, message:"Route not found"});
};

// Last middleware: every thrown / rejected error ends up here (Express 5 forwards async errors)
export const errorHandler = (err, req, res, next)=>{
    if(res.headersSent) return next(err);

    // expected failure thrown by a service: status, code and message are safe to show
    if(err instanceof AppError){
        return res.status(err.status).send({
            success:false,
            code: err.code,
            message: err.message,
            ...(err.errors && {errors: err.errors})
        });
    }
    if(err.type === 'entity.parse.failed'){
        return res.status(400).send({success:false, message:"Invalid JSON body"});
    }
    if(err.type === 'entity.too.large'){
        return res.status(413).send({success:false, message:"Request body too large"});
    }
    if(err.status && err.status < 500){
        return res.status(err.status).send({success:false, message: err.expose ? err.message : "Bad request"});
    }

    // requestId + module are added by the log context (see requestContext.js).
    // The route comes from the request, so it goes in a structured field, never in the message text.
    logger.error('Unhandled error', {
        method: req.method,
        route: req.route?.path ? req.baseUrl + req.route.path : req.originalUrl.split('?')[0],
        ...errorMeta(err)
    });
    // the request id lets a user report an error that we can find in the logs
    res.status(500).send({success:false, message:"Internal server error", requestId: req.id});
};
