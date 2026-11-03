import crypto from 'crypto';

export const sha256 = (value)=> crypto.createHash('sha256').update(value).digest('hex');

// random hex string (bytes * 2 characters)
export const randomToken = (bytes = 32)=> crypto.randomBytes(bytes).toString('hex');

// constant-time string comparison (no timing leak on secrets)
export const safeEqual = (a, b)=>{
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};
