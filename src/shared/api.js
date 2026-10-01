/**
 * Cross-browser WebExtension namespace.
 *
 * Firefox exposes the promise-based `browser` namespace; Chromium (MV3) only
 * exposes `chrome`, whose APIs also return promises when no callback is given.
 * Message listeners must use `sendResponse` + `return true`, which both support.
 */
globalThis.ext = globalThis.browser ?? globalThis.chrome;
