// An expected failure with an HTTP status that is safe to show to the client.
// `code` is stable and greppable: <MODULE>_<REASON>, e.g. MESSAGES_RECEIVER_NOT_FOUND.
// `errors` (optional) lists field problems: [{field, message}] (same shape as validate()).
export class AppError extends Error {
    constructor(status, code, message, {errors} = {}){
        super(message);
        this.name = 'AppError';
        this.status = status;
        this.code = code;
        this.errors = errors;
    }
}

// shorthand for one invalid form field
export const fieldError = (status, code, field, message)=>
    new AppError(status, code, message, {errors: [{field, message}]});
