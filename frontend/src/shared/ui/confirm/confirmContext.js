import { createContext, useContext } from 'react';

export const ConfirmContext = createContext(null);

// const confirm = useConfirm();
// if (await confirm({ title, message, confirmLabel, tone: 'danger', icon: FiLogOut })) { ... }
// Resolves true when confirmed, false when cancelled (Cancel, Esc or a click outside).
export const useConfirm = () => {
    const confirm = useContext(ConfirmContext);
    if (!confirm) throw new Error('useConfirm needs a <ConfirmProvider> above it');
    return confirm;
};
