import { useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../AuthContext';
import { changePassword } from '../api';
import { changePasswordSchema } from '../schemas';
import TextField from '../../../shared/ui/TextField';
import Button from '../../../shared/ui/Button';
import { fieldErrors, serverFieldErrors } from '../../../shared/lib/formErrors';
import { errorBody } from '../../../shared/api/client';

const EMPTY = { currentPassword: '', newPassword: '', confpassword: '' };

// Change the password, or set a first one (Google / GitHub accounts have none)
const ChangePasswordForm = ({ hasPassword, onDone }) => {
    const { updateSession } = useAuth();
    const [form, setForm] = useState(EMPTY);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const setField = (field) => (e) => {
        setForm((f) => ({ ...f, [field]: e.target.value }));
        setErrors((err) => ({ ...err, [field]: undefined }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const result = changePasswordSchema(hasPassword).safeParse(form);
        if (!result.success) return setErrors(fieldErrors(result.error));

        setSaving(true);
        try {
            const { currentPassword, newPassword } = result.data;
            const data = await changePassword(hasPassword ? { currentPassword, newPassword } : { newPassword });
            // other devices are logged out; this one continues with the fresh token
            updateSession({ token: data.token });
            toast.success(`${data.message}. Other devices were logged out.`);
            setForm(EMPTY);
            onDone();
        } catch (error) {
            const data = errorBody(error);
            setErrors(serverFieldErrors(data));
            toast.error(data?.message || 'Could not change password');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} noValidate className='space-y-4 px-3 pb-4 pt-1'>
            {hasPassword && (
                <TextField id='current-password' label='Current password' type='password' autoComplete='current-password'
                    value={form.currentPassword} onChange={setField('currentPassword')} error={errors.currentPassword} />
            )}
            <TextField id='new-password' label='New password' type='password' autoComplete='new-password'
                value={form.newPassword} onChange={setField('newPassword')} error={errors.newPassword}
                hint='At least 6 characters' />
            <TextField id='confirm-new-password' label='Confirm new password' type='password' autoComplete='new-password'
                value={form.confpassword} onChange={setField('confpassword')} error={errors.confpassword} />
            <Button type='submit' loading={saving}>{hasPassword ? 'Change password' : 'Set password'}</Button>
        </form>
    );
};

export default ChangePasswordForm;
