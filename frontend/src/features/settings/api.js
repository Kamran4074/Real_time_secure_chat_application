import api from '../../shared/api/client';

// Calls to the backend's users module for your own profile (/api/user/me)

export const getMe = () => api.get('/api/user/me').then((r) => r.data);

export const updateProfile = (changes) => api.patch('/api/user/me', changes).then((r) => r.data);

// Upload straight to Cloudinary with the parameters our backend signed.
// fetch, not the api client: that would attach our JWT to a request that goes to another site.
export const uploadProfilePhoto = async (file) => {
    const { data: signed } = await api.post('/api/user/me/avatar-signature');
    const { uploadUrl, apiKey, signature, ...params } = signed;
    const body = new FormData();
    body.append('file', file);
    body.append('api_key', apiKey);
    body.append('signature', signature);
    Object.entries(params).forEach(([key, value]) => body.append(key, value));

    const res = await fetch(uploadUrl, { method: 'POST', body });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error?.message || 'Upload failed');
    return json.secure_url;
};
