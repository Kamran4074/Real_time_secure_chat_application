import { test, expect } from '@playwright/test';

// unique per run, so tests never collide with users from an earlier run
const run = Date.now().toString(36);
const makeUser = (name) => ({
    fullname: `${name} Tester`,
    username: `${name.toLowerCase()}_${run}`.slice(0, 20),
    email: `${name.toLowerCase()}.${run}@e2e.test`,
    password: 'secret123',
});

// collects anything the Content-Security-Policy blocked on this page
const watchCsp = (page) => {
    const violations = [];
    page.on('console', msg => {
        if (msg.type() === 'error' && /Content Security Policy/i.test(msg.text())) violations.push(msg.text());
    });
    return violations;
};

const register = async (page, user) => {
    await page.goto('/register');
    await page.getByLabel('Full name').fill(user.fullname);
    await page.getByLabel('Username').fill(user.username);
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill(user.password);
    await page.getByLabel('Confirm password').fill(user.password);
    await page.getByText('female', { exact: true }).click();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByPlaceholder('Search people')).toBeVisible();
};

const login = async (page, user) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Log in' }).click();
};

const openChatWith = async (page, user) => {
    await page.getByPlaceholder('Search people').fill(user.username);
    await page.getByPlaceholder('Search people').press('Enter');
    await page.getByRole('button', { name: new RegExp(user.username) }).click();
};

test('the app is served with security headers', async ({ page }) => {
    const res = await page.goto('/login');
    const headers = res.headers();
    expect(headers['content-security-policy']).toContain("script-src 'self'");
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
});

test.describe('auth', () => {
    test('a logged-out visitor is sent to the login page', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveURL(/\/login$/);
        await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    });

    test('invalid login shows an error and stays on the login page', async ({ page }) => {
        await login(page, { email: `nobody.${run}@e2e.test`, password: 'wrong-pass' });
        await expect(page.getByText('Invalid email or password')).toBeVisible();
        await expect(page).toHaveURL(/\/login$/);
    });

    test('register, log out and log back in', async ({ page }) => {
        const user = makeUser('Cara');
        await register(page, user);

        page.once('dialog', dialog => dialog.accept()); // "Do you want to log out?"
        await page.getByRole('button', { name: 'Log out' }).click();
        await expect(page).toHaveURL(/\/login$/);

        await login(page, user);
        await expect(page.getByPlaceholder('Search people')).toBeVisible();
    });
});

test('two users chat in real time', async ({ browser }) => {
    const alice = makeUser('Alice');
    const bob = makeUser('Bob');

    // separate contexts = two different browsers with their own sessions
    const alicePage = await (await browser.newContext()).newPage();
    const bobPage = await (await browser.newContext()).newPage();
    const cspViolations = [watchCsp(alicePage), watchCsp(bobPage)];
    await register(alicePage, alice);
    await register(bobPage, bob);

    await openChatWith(alicePage, bob);
    const text = `Hello Bob, this is ${run}`;
    await alicePage.getByLabel('Type a message').fill(text);
    await alicePage.getByRole('button', { name: 'Send message' }).click();
    await expect(alicePage.getByText(text)).toBeVisible();

    // Bob gets it over Socket.IO without reloading: Alice appears in his chat list
    await bobPage.getByRole('button', { name: new RegExp(alice.username) }).click();
    await expect(bobPage.getByText(text)).toBeVisible();

    // and the reply arrives live on Alice's open chat
    await bobPage.getByLabel('Type a message').fill('Hi Alice!');
    await bobPage.getByRole('button', { name: 'Send message' }).click();
    await expect(alicePage.getByText('Hi Alice!')).toBeVisible();

    // API calls, the socket, fonts and avatars all passed the CSP
    expect(cspViolations.flat()).toEqual([]);
});

test('HTML in a message is shown as text, not executed', async ({ browser }) => {
    const sender = makeUser('Dan');
    const receiver = makeUser('Eve');
    const senderPage = await (await browser.newContext()).newPage();
    const receiverPage = await (await browser.newContext()).newPage();
    await register(senderPage, sender);
    await register(receiverPage, receiver);

    let alerted = false;
    receiverPage.on('dialog', async dialog => { alerted = true; await dialog.dismiss(); });

    const payload = '<img src=x onerror="alert(1)">';
    await openChatWith(senderPage, receiver);
    await senderPage.getByLabel('Type a message').fill(payload);
    await senderPage.getByRole('button', { name: 'Send message' }).click();

    await receiverPage.getByRole('button', { name: new RegExp(sender.username) }).click();
    await expect(receiverPage.getByText(payload)).toBeVisible();
    expect(alerted).toBe(false);
});
