import Login from "./login/Login.jsx"
import { ToastContainer} from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Route ,Routes, Navigate } from "react-router-dom";
import Register from "./register/Register.jsx";
import Home from "./home/Home.jsx";
import { VerifyUser } from "./utils/VerifyUser.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import ServerStatus from "./components/ServerStatus.jsx";
import OAuthHandler from "./components/OAuthHandler.jsx";

function App() {
  const {authUser} = useAuth();
  
  return (
    <>
    <div className="min-h-[100dvh] w-full">
      <ServerStatus/>
      <OAuthHandler/>
      <Routes>
        <Route path="/login" element={!authUser ? <Login/> : <Navigate to='/'/>}/>
        <Route path="/register" element={!authUser ? <Register/> : <Navigate to='/'/>}/>
        <Route element={<VerifyUser/>}>
          <Route path="/" element={<Home/>}/>
          <Route path="/profile/:id" element={<Home/>}/>
        </Route>
        <Route path="*" element={<Navigate to={authUser ? '/' : '/login'}/>}/>
      </Routes>
      <ToastContainer position="top-right" autoClose={3000} newestOnTop theme="light"/>
    </div>

    </>
  )
}

export default App
