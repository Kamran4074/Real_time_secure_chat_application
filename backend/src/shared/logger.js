import winston from 'winston';
import { getContext } from './requestContext.js';

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';
// JSON in production (Render/Docker log search), readable lines locally
const useJson = (process.env.LOG_FORMAT || (isProd ? 'json' : 'pretty')) === 'json';

// adds requestId + module of the current request (if any) to every log line
const requestContext = winston.format((info)=>{
    const context = getContext();
    if(context){
        info.requestId ??= context.requestId;
        if(context.module) info.module ??= context.module;
    }
    return info;
});

const pretty = printf(({ timestamp: time, level, message, stack, ...meta }) => {
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${time} ${level} ${message}${extra}${stack ? `\n${stack}` : ''}`;
});

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
    format: useJson
        ? combine(requestContext(), timestamp(), errors({ stack: true }), json())
        : combine(
            requestContext(),
            // colours only in a real terminal, not in hosted log viewers
            ...(process.stdout.isTTY ? [colorize()] : []),
            timestamp({ format: 'HH:mm:ss' }),
            errors({ stack: true }),
            pretty
        ),
    defaultMeta: useJson ? { service: 'chatwave-api' } : undefined,
    transports: [
        // tests stay quiet unless LOG_LEVEL is set explicitly
        new winston.transports.Console({ silent: isTest && !process.env.LOG_LEVEL }),
    ],
});

// Turn any thrown value into log fields
export const errorMeta = (err)=> err instanceof Error
    ? { error: err.message, stack: err.stack }
    : { error: String(err) };

export default logger;
