import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Route, Routes, Navigate } from 'react-router-dom';
import { useAuth, RequireAuth, OAuthHandler, Login, Register, ForgotPassword, ResetPassword } from './features/auth';
import ServerStatus from './shared/components/ServerStatus';
import Home from './Home';

function App() {
  const { authUser } = useAuth();

  return (
    <div className="min-h-[100dvh] w-full">
      <ServerStatus/>
      <OAuthHandler/>
      <Routes>
        <Route path="/login" element={!authUser ? <Login/> : <Navigate to='/'/>}/>
        <Route path="/register" element={!authUser ? <Register/> : <Navigate to='/'/>}/>
        <Route path="/forgot-password" element={!authUser ? <ForgotPassword/> : <Navigate to='/'/>}/>
        {/* reachable while logged in too: the link comes from an email */}
        <Route path="/reset-password" element={<ResetPassword/>}/>
        <Route element={<RequireAuth/>}>
          <Route path="/" element={<Home/>}/>
        </Route>
        <Route path="*" element={<Navigate to={authUser ? '/' : '/login'}/>}/>
      </Routes>
      <ToastContainer position="top-right" autoClose={3000} newestOnTop theme="light"/>
    </div>
  )
}

export default App
