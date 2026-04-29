export async function register() {
  // Prevent socket-write races (e.g. ERR_HTTP_HEADERS_SENT on client disconnect)
  // from taking down the entire Next.js standalone process.
  process.on('uncaughtException', (err: Error) => {
    if ((err as NodeJS.ErrnoException).code === 'ERR_HTTP_HEADERS_SENT') {
      // Client disconnected before the response finished — not fatal.
      console.warn('[instrumentation] suppressed ERR_HTTP_HEADERS_SENT:', err.message);
      return;
    }
    // Re-throw anything else so genuinely fatal errors still surface.
    console.error('[instrumentation] uncaughtException:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    console.error('[instrumentation] unhandledRejection:', reason);
  });
}
