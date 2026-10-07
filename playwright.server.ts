// Separate local worktrees can certify their own production artifacts without
// accidentally reusing another checkout's preview server. CI keeps the default.
const port = Number(process.env.MDD_TEST_PORT ?? 4173);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error("MDD_TEST_PORT must be an unprivileged TCP port.");
export const testOrigin = `http://127.0.0.1:${port}`;
export const testPreviewCommand = `npx vite preview --host 127.0.0.1 --port ${port} --strictPort`;
