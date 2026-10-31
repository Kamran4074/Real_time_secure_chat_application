// Frontend origins allowed to call the API and open sockets.
// Override with CLIENT_ORIGINS="https://a.com,http://localhost:8080"
const allowedOrigins = process.env.CLIENT_ORIGINS
    ? process.env.CLIENT_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : ['http://localhost:5173', 'https://chatwave-azure.vercel.app'];

export default allowedOrigins;
