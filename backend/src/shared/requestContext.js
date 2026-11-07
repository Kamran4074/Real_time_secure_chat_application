import { AsyncLocalStorage } from 'async_hooks';

// Per-request data that every log line picks up automatically (requestId, module),
// so services can log without being handed `req`.
const storage = new AsyncLocalStorage();

export const runWithContext = (context, fn)=> storage.run(context, fn);

export const getContext = ()=> storage.getStore();
