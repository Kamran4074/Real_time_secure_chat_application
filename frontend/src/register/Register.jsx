import axios from 'axios';
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify';
import { FiUser, FiAtSign, FiMail, FiLock, FiAlertCircle } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import OAuthButtons, { Divider } from '../components/OAuthButtons';
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';
import { registerSchema, fieldErrors, serverFieldErrors } from '../validation/authSchemas';

const GENDERS = ['male', 'female', 'other'];
const FIELD_ORDER = ['fullname', 'username', 'email', 'password', 'confpassword', 'gender'];

const Register = () => {
    const navigate = useNavigate()
    const {setAuthUser} = useAuth();
    const [loading , setLoading] = useState(false);
    const [inputData , setInputData] = useState({})
    const [errors, setErrors] = useState({});

    const clearError = (field) => {
        if (errors[field]) setErrors(({ [field]: _, ...rest }) => rest);
    }

    const handelInput=(e)=>{
        setInputData({
            ...inputData , [e.target.id]:e.target.value
        })
        clearError(e.target.id);
    }

    const selectGender=(gender)=>{
        setInputData((prev)=>({ ...prev , gender }))
        clearError('gender');
    }

    const showErrors = (found) => {
        setErrors(found);
        // move focus to the first field with a problem
        const first = FIELD_ORDER.find(f => found[f]);
        document.getElementById(first === 'gender' ? 'gender-male' : first)?.focus();
    }

    const handelSubmit=async(e)=>{
        e.preventDefault();
        const result = registerSchema.safeParse(inputData);
        if (!result.success) return showErrors(fieldErrors(result.error));

        setLoading(true)
        try {
            // confpassword is only checked here, never sent to the server
            const { confpassword, ...payload } = result.data;
            const register = await axios.post(`/api/auth/register`,payload);
            const data = register.data;
            toast.success(data?.message)
            localStorage.setItem('chatapp',JSON.stringify(data))
            setAuthUser(data)
            setLoading(false)
            navigate('/')
        } catch (error) {
            setLoading(false)
            const data = error?.response?.data;
            // "Username already exists" / "Email already exists" belong next to their field
            const found = serverFieldErrors(data);
            if (/username/i.test(data?.message || '')) found.username ??= data.message;
            if (/email/i.test(data?.message || '')) found.email ??= data.message;
            if (Object.keys(found).length) showErrors(found);
            toast.error(data?.message || "Registration failed")
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
        <form onSubmit={handelSubmit} noValidate className='space-y-4'>
            <TextField id='fullname' label='Full name' icon={FiUser} error={errors.fullname}
                placeholder='Aisha Khan' autoComplete='name' required maxLength={60} onChange={handelInput} />
            <TextField id='username' label='Username' icon={FiAtSign} error={errors.username}
                placeholder='aisha_k' autoComplete='username' required maxLength={20}
                hint='3–20 characters: letters, numbers, _ or .' onChange={handelInput} />
            <TextField id='email' type='email' label='Email' icon={FiMail} error={errors.email}
                placeholder='you@example.com' autoComplete='email' required onChange={handelInput} />
            <div className='grid gap-4 sm:grid-cols-2'>
                <TextField id='password' type='password' label='Password' icon={FiLock} error={errors.password}
                    placeholder='Min. 6 chars' autoComplete='new-password' required maxLength={72}
                    onChange={handelInput} />
                <TextField id='confpassword' type='password' label='Confirm password' icon={FiLock} error={errors.confpassword}
                    placeholder='Repeat it' autoComplete='new-password' required onChange={handelInput} />
            </div>

            <fieldset aria-describedby={errors.gender ? 'gender-error' : undefined}>
                <legend className='mb-1.5 block text-sm font-medium text-slate-700'>Gender</legend>
                <div className={`grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 ${errors.gender ? 'ring-1 ring-rose-400' : ''}`}>
                    {GENDERS.map(g => (
                        <label key={g} className='cursor-pointer'>
                            <input type='radio' name='gender' id={`gender-${g}`} value={g} className='peer sr-only'
                                checked={inputData.gender === g} onChange={() => selectGender(g)} />
                            <span className='block rounded-lg py-2 text-center text-sm font-medium capitalize text-slate-600 transition
                                hover:text-slate-900 peer-checked:bg-white peer-checked:text-brand-700 peer-checked:shadow-sm
                                peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500'>
                                {g}
                            </span>
                        </label>
                    ))}
                </div>
                {errors.gender && (
                    <p id='gender-error' role='alert' className='mt-1.5 flex items-center gap-1 text-xs font-medium text-rose-600'>
                        <FiAlertCircle aria-hidden className='shrink-0' /> {errors.gender}
                    </p>
                )}
            </fieldset>

            <Button type='submit' loading={loading} className='!mt-6'>
                {loading ? 'Creating account…' : 'Create account'}
            </Button>
        </form>
    </AuthLayout>
  )
}

export default Register
