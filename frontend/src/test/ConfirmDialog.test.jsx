import { describe, test, expect } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmProvider from '../shared/ui/confirm/ConfirmProvider';
import { useConfirm } from '../shared/ui/confirm/confirmContext';

// a button that asks, then shows the answer
const Asker = ({ tone = 'danger' }) => {
    const confirm = useConfirm();
    const [answer, setAnswer] = useState('none');
    const ask = async () => setAnswer(String(await confirm({
        title: 'Delete it?', message: 'This cannot be undone.', confirmLabel: 'Delete', tone,
    })));
    return <><button onClick={ask}>Ask</button><p>answer: {answer}</p></>;
};

const renderAsker = (props) => render(<ConfirmProvider><Asker {...props} /></ConfirmProvider>);

describe('confirm dialog', () => {
    test('shows title and message, and resolves true on confirm', async () => {
        renderAsker();
        await userEvent.click(screen.getByRole('button', { name: 'Ask' }));

        const dialog = screen.getByRole('alertdialog', { name: 'Delete it?' });
        expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
        await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

        expect(await screen.findByText('answer: true')).toBeInTheDocument();
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    test('Cancel, Escape and a click outside all resolve false', async () => {
        renderAsker();
        const ask = () => userEvent.click(screen.getByRole('button', { name: 'Ask' }));

        await ask();
        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(await screen.findByText('answer: false')).toBeInTheDocument();

        await ask();
        await userEvent.keyboard('{Escape}');
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

        await ask();
        await userEvent.click(screen.getByRole('alertdialog').parentElement); // the backdrop
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        expect(screen.getByText('answer: false')).toBeInTheDocument();
    });

    test('destructive dialogs focus Cancel; Tab stays inside; focus returns afterwards', async () => {
        renderAsker();
        const askButton = screen.getByRole('button', { name: 'Ask' });
        await userEvent.click(askButton);

        expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
        await userEvent.tab();
        expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();
        await userEvent.tab();
        expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

        await userEvent.keyboard('{Escape}');
        expect(askButton).toHaveFocus();
    });

    test('non-destructive dialogs focus the confirm button', async () => {
        renderAsker({ tone: 'primary' });
        await userEvent.click(screen.getByRole('button', { name: 'Ask' }));
        expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();
    });
});
