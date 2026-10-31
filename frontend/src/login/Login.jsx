import axios from 'axios';
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { FiMail, FiLock } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import OAuthButtons, { Divider } from '../components/OAuthButtons';
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';
import { loginSchema, fieldErrors, serverFieldErrors } from '../validation/authSchemas';

const Login = () => {

    const navigate = useNavigate();
    const {setAuthUser} = useAuth();

    const [userInput, setUserInput] = useState({});
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false)

    const handelInput = (e) => {
        setUserInput({
            ...userInput, [e.target.id]: e.target.value
        })
        // clear the error of the field being fixed
        if (errors[e.target.id]) setErrors(({ [e.target.id]: _, ...rest }) => rest);
    }

    const handelSubmit = async (e) => {
        e.preventDefault();
        const result = loginSchema.safeParse(userInput);
        if (!result.success) {
            const found = fieldErrors(result.error);
            setErrors(found);
            document.getElementById(Object.keys(found)[0])?.focus();
            return;
        }

        setLoading(true)
        try {
            const login = await axios.post(`/api/auth/login`, result.data);
            const data = login.data;
            toast.success(data.message)
            localStorage.setItem('chatapp',JSON.stringify(data));
            setAuthUser(data)
            setLoading(false)
            navigate('/')
        } catch (error) {
            setLoading(false)
            setErrors(serverFieldErrors(error?.response?.data))
            toast.error(error?.response?.data?.message || "Login failed")
        }
    }

    return (
        <AuthLayout
            title='Welcome back'
            subtitle='Log in to continue your conversations.'
            footer={<>New to ChatWave?{' '}
                <Link to='/register' className='font-semibold text-brand-600 hover:text-brand-700'>Create an account</Link>
            </>}
        >
            <OAuthButtons />
            <Divider text='or continue with email' />
            <form onSubmit={handelSubmit} noValidate className='space-y-4'>
                <TextField id='email' type='email' label='Email' icon={FiMail} error={errors.email}
                    placeholder='you@example.com' autoComplete='email' required onChange={handelInput} />
                <TextField id='password' type='password' label='Password' icon={FiLock} error={errors.password}
                    placeholder='Enter your password' autoComplete='current-password' required onChange={handelInput} />
                <div className='flex justify-end'>
                    <Link to='/forgot-password' className='text-sm font-semibold text-brand-600 hover:text-brand-700'>Forgot password?</Link>
                </div>
                <Button type='submit' loading={loading} className='!mt-6'>
                    {loading ? 'Logging in…' : 'Log in'}
                </Button>
            </form>
        </AuthLayout>
    )
}

export default Login
