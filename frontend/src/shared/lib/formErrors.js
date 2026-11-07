// ZodError -> { field: firstMessage }
export const fieldErrors = (error) => {
    const out = {};
    for (const issue of error.issues) {
        const field = issue.path[0];
        if (field && !out[field]) out[field] = issue.message;
    }
    return out;
};

// Backend error responses carry errors: [{ field, message }]
export const serverFieldErrors = (data) => {
    const out = {};
    for (const { field, message } of data?.errors || []) {
        if (field && !out[field]) out[field] = message;
    }
    return out;
};
