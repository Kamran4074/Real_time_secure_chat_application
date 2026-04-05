import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import { AuthContextProvider } from './context/AuthContext.jsx'
import { SocketContextProvider } from './context/SocketContext.jsx'
import axios from 'axios'

// In production, point axios directly to the Render backend
axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
axios.defaults.withCredentials = true

// Attach JWT token from localStorage to every request
axios.interceptors.request.use((config) => {
    const user = JSON.parse(localStorage.getItem('chatapp'));
    if(user?.token) {
        config.headers.Authorization = `Bearer ${user.token}`;
    }
    return config;
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
  <AuthContextProvider>
    <SocketContextProvider>
    <App />
    </SocketContextProvider>
  </AuthContextProvider>
  </BrowserRouter>
)
