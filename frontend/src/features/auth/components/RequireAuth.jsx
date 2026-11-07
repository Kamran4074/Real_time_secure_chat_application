import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

// Route guard: renders the nested routes only for a logged-in user
const RequireAuth = () => {
    const { authUser } = useAuth();
    return authUser ? <Outlet /> : <Navigate to='/login' />;
};

export default RequireAuth;
