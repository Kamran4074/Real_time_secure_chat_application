import { useCallback, useState } from 'react';
import { ConfirmContext } from './confirmContext';
import ConfirmDialog from './ConfirmDialog';

// Makes useConfirm() available below it and renders the dialog when one is open
const ConfirmProvider = ({ children }) => {
    const [request, setRequest] = useState(null); // { ...dialog options, resolve }

    const confirm = useCallback((options) => new Promise((resolve) => {
        setRequest((open) => {
            open?.resolve(false); // a new question replaces an unanswered one
            return { ...options, resolve };
        });
    }), []);

    const close = (result) => {
        request?.resolve(result);
        setRequest(null);
    };

    const { resolve: _resolve, ...dialog } = request || {};
    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {request && <ConfirmDialog {...dialog} onClose={close} />}
        </ConfirmContext.Provider>
    );
};

export default ConfirmProvider;
