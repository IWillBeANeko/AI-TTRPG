let closed = false;
let session = new AbortController();
const listeners = new Set();

function notify() {
  const live = isPageLive();
  listeners.forEach((fn) => {
    try {
      fn(live);
    } catch {
      /* ignore */
    }
  });
}

function abortSession() {
  if (!session.signal.aborted) session.abort();
}

function closePage(fromBfCache = false) {
  abortSession();
  closed = !fromBfCache;
  notify();
}

function resumePage() {
  closed = false;
  if (session.signal.aborted) session = new AbortController();
  notify();
}

function install() {
  if (typeof window === "undefined" || window.__chronodeckPageSession) return;
  window.__chronodeckPageSession = true;
  window.addEventListener("pagehide", (event) => {
    closePage(Boolean(event.persisted));
  });
  window.addEventListener("pageshow", () => {
    resumePage();
  });
  document.addEventListener("visibilitychange", notify);
}

install();

export function abortError(message = "Aborted") {
  try {
    return new DOMException(message, "AbortError");
  } catch {
    const error = new Error(message);
    error.name = "AbortError";
    return error;
  }
}

export function isAbortError(error) {
  const name = String(error?.name || "");
  const message = String(error?.message || error || "");
  return name === "AbortError" || /aborted|AbortError/i.test(message);
}

export function isPageLive() {
  if (closed) return false;
  if (typeof document === "undefined") return true;
  return document.visibilityState !== "hidden";
}

export function subscribePageLive(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function pageSignal() {
  return session.signal;
}

export function mergeAbortSignals(timeoutMs, extra) {
  const controller = new AbortController();
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const inputs = [session.signal, extra].filter(Boolean);
  const onAbort = () => {
    if (!controller.signal.aborted) controller.abort();
    if (timer) clearTimeout(timer);
  };
  for (const signal of inputs) {
    if (signal.aborted) {
      onAbort();
      break;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    dispose() {
      if (timer) clearTimeout(timer);
      for (const signal of inputs) {
        signal.removeEventListener("abort", onAbort);
      }
    },
  };
}
