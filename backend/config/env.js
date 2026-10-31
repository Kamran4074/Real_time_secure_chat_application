import { z } from 'zod';
import logger from '../utils/logger.js';

// treat "KEY=" (empty) in .env the same as not set
const blank = (schema)=> z.preprocess(value => (value === '' ? undefined : value), schema);
const optionalUrl = (name)=> blank(z.url({ error: `${name} must be a full URL, e.g. https://example.com` }).optional());

const envSchema = z.object({
    NODE_ENV: blank(z.enum(['development', 'production', 'test']).optional()),
    PORT: blank(z.coerce.number().int().min(1).max(65535).default(3000)),
    MONGODB_CONNECT: z.string({ error: "MONGODB_CONNECT is required" })
        .regex(/^mongodb(\+srv)?:\/\//, "MONGODB_CONNECT must start with mongodb:// or mongodb+srv://"),
    JWT_SECRET: z.string({ error: "JWT_SECRET is required" }).min(1, "JWT_SECRET is required"),
    CLIENT_ORIGINS: blank(z.string().optional()),
    SERVER_URL: optionalUrl('SERVER_URL'),
    CLIENT_URL: optionalUrl('CLIENT_URL'),
    LOG_LEVEL: blank(z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).optional()),
    LOG_FORMAT: blank(z.enum(['json', 'pretty']).optional()),
    AUTH_RATE_LIMIT: blank(z.coerce.number().int().positive().optional()),
    API_RATE_LIMIT: blank(z.coerce.number().int().positive().optional()),
    MESSAGE_RATE_LIMIT: blank(z.coerce.number().int().positive().optional()),
    SEARCH_RATE_LIMIT: blank(z.coerce.number().int().positive().optional()),
    SOCKET_EVENT_LIMIT: blank(z.coerce.number().int().positive().optional()),
    GOOGLE_CLIENT_ID: blank(z.string().optional()),
    GOOGLE_CLIENT_SECRET: blank(z.string().optional()),
    GITHUB_CLIENT_ID: blank(z.string().optional()),
    GITHUB_CLIENT_SECRET: blank(z.string().optional()),
    BREVO_API_KEY: blank(z.string().optional()),
    EMAIL_FROM: blank(z.email({ error: "EMAIL_FROM must be an email address" }).optional()),
    EMAIL_FROM_NAME: blank(z.string().optional()),
}).superRefine((env, ctx)=>{
    // half-configured OAuth is almost always a copy/paste mistake
    for(const provider of ['GOOGLE', 'GITHUB']){
        const id = env[`${provider}_CLIENT_ID`];
        const secret = env[`${provider}_CLIENT_SECRET`];
        if(Boolean(id) !== Boolean(secret)){
            ctx.addIssue({
                code: 'custom',
                path: [id ? `${provider}_CLIENT_SECRET` : `${provider}_CLIENT_ID`],
                message: `${provider}_CLIENT_ID and ${provider}_CLIENT_SECRET must be set together`
            });
        }
    }
});

// Validate process.env once at startup; exit with a clear list of problems if it's wrong
export const loadEnv = ()=>{
    const result = envSchema.safeParse(process.env);
    if(!result.success){
        for(const issue of result.error.issues){
            logger.error(`Invalid environment: ${issue.path.join('.')}: ${issue.message}`);
        }
        process.exit(1);
    }

    const env = result.data;
    if(Boolean(env.BREVO_API_KEY) !== Boolean(env.EMAIL_FROM)){
        logger.warn("Set both BREVO_API_KEY and EMAIL_FROM to send emails; password reset emails are disabled");
    }
    if(env.JWT_SECRET.length < 32){
        logger.warn("JWT_SECRET is short; use at least 32 random characters in production");
    }
    return env;
};
