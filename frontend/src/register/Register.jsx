import axios from 'axios';
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify';
import { FiUser, FiAtSign, FiMail, FiLock } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import OAuthButtons, { Divider } from '../components/OAuthButtons';
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';

const GENDERS = ['male', 'female', 'other'];

const Register = () => {
    const navigate = useNavigate()
    const {setAuthUser} = useAuth();
    const [loading , setLoading] = useState(false);
    const [inputData , setInputData] = useState({})

    const handelInput=(e)=>{
        setInputData({
            ...inputData , [e.target.id]:e.target.value
        })
    }

    const selectGender=(gender)=>{
        setInputData((prev)=>({ ...prev , gender }))
    }

    const handelSubmit=async(e)=>{
        e.preventDefault();
        setLoading(true)
        if(inputData.password !== inputData.confpassword){
            setLoading(false)
            return toast.error("Passwords don't match")
        }
        if((inputData.password || '').length < 6){
            setLoading(false)
            return toast.error("Password must be at least 6 characters")
        }
        if(!inputData.gender){
            setLoading(false)
            return toast.error("Please select a gender")
        }
        try {
            // confpassword is only checked here, never sent to the server
            const { confpassword, ...payload } = inputData;
            const register = await axios.post(`/api/auth/register`,payload);
            const data = register.data;
            toast.success(data?.message)
            localStorage.setItem('chatapp',JSON.stringify(data))
            setAuthUser(data)
            setLoading(false)
            navigate('/')
        } catch (error) {
            setLoading(false)
            toast.error(error?.response?.data?.message || "Registration failed")
        }
    }

  return (
    <AuthLayout
        title='Create your account'
        subtitle='Start chatting in less than a minute.'
        footer={<>Already have an account?{' '}
            <Link to='/login' className='font-semibold text-brand-600 hover:text-brand-700'>Log in</Link>
        </>}
    >
        <OAuthButtons />
        <Divider text='or sign up with email' />
        <form onSubmit={handelSubmit} className='space-y-4'>
            <TextField id='fullname' label='Full name' icon={FiUser}
                placeholder='Aisha Khan' autoComplete='name' required onChange={handelInput} />
            <TextField id='username' label='Username' icon={FiAtSign}
                placeholder='aisha_k' autoComplete='username' required minLength={3} maxLength={20}
                pattern='[a-zA-Z0-9_.]{3,20}' title='3-20 letters, numbers, _ or .'
                hint='3–20 characters: letters, numbers, _ or .' onChange={handelInput} />
            <TextField id='email' type='email' label='Email' icon={FiMail}
                placeholder='you@example.com' autoComplete='email' required onChange={handelInput} />
            <div className='grid gap-4 sm:grid-cols-2'>
                <TextField id='password' type='password' label='Password' icon={FiLock}
                    placeholder='Min. 6 chars' autoComplete='new-password' required minLength={6} maxLength={72}
                    onChange={handelInput} />
                <TextField id='confpassword' type='password' label='Confirm password' icon={FiLock}
                    placeholder='Repeat it' autoComplete='new-password' required onChange={handelInput} />
            </div>

            <fieldset>
                <legend className='mb-1.5 block text-sm font-medium text-slate-700'>Gender</legend>
                <div className='grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1'>
                    {GENDERS.map(g => (
                        <label key={g} className='cursor-pointer'>
                            <input type='radio' name='gender' value={g} className='peer sr-only'
                                checked={inputData.gender === g} onChange={() => selectGender(g)} />
                            <span className='block rounded-lg py-2 text-center text-sm font-medium capitalize text-slate-600 transition
                                hover:text-slate-900 peer-checked:bg-white peer-checked:text-brand-700 peer-checked:shadow-sm
                                peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500'>
                                {g}
                            </span>
                        </label>
                    ))}
                </div>
            </fieldset>

            <Button type='submit' loading={loading} className='!mt-6'>
                {loading ? 'Creating account…' : 'Create account'}
            </Button>
        </form>
    </AuthLayout>
  )
}

export default Register
