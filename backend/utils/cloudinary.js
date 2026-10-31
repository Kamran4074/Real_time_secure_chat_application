import crypto from "crypto";

// Profile photos go straight from the browser to Cloudinary (the file never passes through this server).
// The server only signs the upload, so the browser can't pick another folder, file name, size or format.
// Needs CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET; without them photo upload is off.

const FOLDER = 'chatwave/avatars';
// what the browser may send; whatever it is, Cloudinary stores it as WebP (smallest for photos)
const ALLOWED_FORMATS = 'jpg,jpeg,png,webp';
const STORED_FORMAT = 'webp';
// applied by Cloudinary before storing: 400x400 crop around the face, automatic quality, converted to WebP.
// (f_ must be inside the transformation: a separate "format" param is ignored when a transformation is given)
const TRANSFORMATION = `c_fill,g_face,w_400,h_400,q_auto,f_${STORED_FORMAT}`;

export const isUploadEnabled = ()=> Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
);

// Cloudinary signature: sha1 of the sorted "key=value" pairs joined by "&", followed by the API secret
const sign = (params)=>{
    const payload = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&');
    return crypto.createHash('sha1').update(payload + process.env.CLOUDINARY_API_SECRET).digest('hex');
};

// Everything the browser must send to Cloudinary along with the file
export const signAvatarUpload = (userId)=>{
    const params = {
        allowed_formats: ALLOWED_FORMATS,
        folder: FOLDER,
        overwrite: 'true',
        public_id: userId.toString(), // one photo per user; a new upload replaces the old one
        timestamp: Math.floor(Date.now()/1000), // Cloudinary rejects signatures older than 1 hour
        transformation: TRANSFORMATION
    };
    return {
        uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
        apiKey: process.env.CLOUDINARY_API_KEY,
        signature: sign(params),
        ...params
    };
};

// Accept only this user's photo in our own Cloudinary account, e.g.
// https://res.cloudinary.com/<cloud>/image/upload/v1712345678/chatwave/avatars/<userId>.jpg
export const isOwnAvatarUrl = (url, userId)=>{
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    if(!cloud || typeof url !== 'string') return false;
    const prefix = `https://res.cloudinary.com/${cloud}/image/upload/`;
    if(!url.startsWith(prefix)) return false;
    return new RegExp(`^(v\\d+/)?${FOLDER}/${userId}\\.${STORED_FORMAT}$`).test(url.slice(prefix.length));
};
