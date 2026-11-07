// Validates req.params / req.query / req.body with Zod schemas.
// On failure: 400 { success:false, message:<first problem>, errors:[{field, message}] }
// On success: cleaned data is in req.valid.{params,query,body} (and req.body is replaced).
const validate = (schemas)=> (req, res, next)=>{
    const valid = {};

    for(const part of ['params', 'query', 'body']){
        if(!schemas[part]) continue;
        const result = schemas[part].safeParse(req[part] ?? {});
        if(!result.success){
            const issues = result.error.issues;
            return res.status(400).send({
                success: false,
                message: issues[0].message,
                errors: issues.map(issue => ({ field: issue.path.join('.'), message: issue.message }))
            });
        }
        valid[part] = result.data;
    }

    req.valid = valid;
    if(valid.body) req.body = valid.body;
    next();
};

export default validate;
