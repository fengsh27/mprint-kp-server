export async function register() {
  // process.on is Node.js-only — not available in the Edge Runtime that runs middleware.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Prevent socket-write races and client disconnects from taking down the
  // entire Next.js standalone process.
  //
  // These all mean "the other end of an HTTP connection went away before the
  // response finished" — a browser tab closed, a navigation cancelled an
  // in-flight fetch, a proxy timed out. None of them leave this process in a
  // bad state, but Node surfaces them as uncaught exceptions, so exiting on
  // them takes down every other in-flight request with them. On a single
  // container that is a full restart triggered by one user closing a tab,
  // which is very reachable here because several queries take seconds.
  const NON_FATAL_CONNECTION_ERRORS = new Set([
    'ERR_HTTP_HEADERS_SENT',       // wrote to a response that already finished
    'ECONNRESET',                  // peer reset the connection (Node: "aborted")
    'ECONNABORTED',                // connection aborted before completion
    'EPIPE',                       // wrote to a socket the peer already closed
    'ERR_STREAM_PREMATURE_CLOSE'   // stream ended before it was done
  ]);

  process.on('uncaughtException', (err: Error) => {
    const code = (err as NodeJS.ErrnoException).code;
    if (code && NON_FATAL_CONNECTION_ERRORS.has(code)) {
      // Logged, not silent: still visible if these start appearing in bulk,
      // which would point at a proxy or upstream problem rather than a user
      // simply navigating away.
      console.warn(`[instrumentation] suppressed ${code}:`, err.message);
      return;
    }
    // Anything else leaves the process in an undefined state — exit and let
    // the platform restart it.
    console.error('[instrumentation] uncaughtException:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    console.error('[instrumentation] unhandledRejection:', reason);
  });
}
