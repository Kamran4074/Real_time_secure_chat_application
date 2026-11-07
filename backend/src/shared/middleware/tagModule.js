import { getContext } from '../requestContext.js';

// Mounted in front of each module's router: every log line of the request then says which module handled it
const tagModule = (name)=> (req, res, next)=>{
    req.module = name;
    const context = getContext();
    if(context) context.module = name;
    next();
};

export default tagModule;
