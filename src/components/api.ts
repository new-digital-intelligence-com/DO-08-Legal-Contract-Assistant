"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The one place the console talks to its own API.
 *
 * It exists to make a single rule cheap to follow: **a failed fetch never
 * renders as an empty result.** Every panel here lists things a lawyer is
 * meant to act on, and a queue that shows "nothing to sign off" because a
 * request 500'd is worse than one that shows an error — the first looks like
 * work finished.
 *
 * So `useApi` returns three distinguishable states rather than data-or-nothing,
 * and every panel is expected to branch on all three.
 */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Read the API's `{ error }` shape, falling back to something a person can act on. */
export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers:
      init?.body instanceof FormData
        ? init.headers
        : { "content-type": "application/json", ...(init?.headers ?? {}) },
  });

  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(
      `The server answered ${response.status} with something that was not JSON.`,
      response.status,
    );
  }

  if (!response.ok) {
    const message =
      (payload as { error?: string })?.error ?? `The request failed (${response.status}).`;
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

export type Loadable<T> = {
  data: T | undefined;
  /** True until the first response, and again on an explicit reload. */
  loading: boolean;
  /** Set when the fetch failed. Never confused with an empty result. */
  error: string | undefined;
  reload: () => void;
};

export function useApi<T>(url: string | undefined, deps: unknown[] = []): Loadable<T> {
  const [nonce, setNonce] = useState(0);

  /*
   * One piece of state, tagged with the request it belongs to.
   *
   * Three separate `useState`s reset in an effect would render the previous
   * screen's data under the new screen's heading for a frame, and would set
   * state synchronously inside an effect — a cascading render React now warns
   * about. Keying the state to the request and adjusting it during render is
   * React's documented pattern for exactly this, and it makes "loading the
   * thing we are actually looking at" true on the first render rather than the
   * second.
   */
  const key = `${url ?? ""}::${nonce}::${JSON.stringify(deps)}`;
  const [state, setState] = useState<{
    key: string;
    data: T | undefined;
    loading: boolean;
    error: string | undefined;
  }>({ key, data: undefined, loading: Boolean(url), error: undefined });

  if (state.key !== key) {
    setState({ key, data: undefined, loading: Boolean(url), error: undefined });
  }

  // Guards against a slow request resolving after a fast later one and
  // overwriting it — which shows a stale contract under a fresh heading.
  const latest = useRef("");

  useEffect(() => {
    // No url is not a request. The render-time adjustment above has already
    // set `loading: false` for that case, so there is nothing to do here.
    if (!url) return;
    latest.current = key;

    request<T>(url)
      .then((value) => {
        if (latest.current !== key) return;
        setState({ key, data: value, loading: false, error: undefined });
      })
      .catch((caught: unknown) => {
        if (latest.current !== key) return;
        setState({
          key,
          data: undefined,
          loading: false,
          error: caught instanceof Error ? caught.message : String(caught),
        });
      });
  }, [url, key]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  return { data: state.data, loading: state.loading, error: state.error, reload };
}

/** A one-shot action with its own busy and error state, for buttons. */
export function useAction<Args extends unknown[], T>(
  run: (...args: Args) => Promise<T>,
): {
  busy: boolean;
  error: string | undefined;
  clearError: () => void;
  go: (...args: Args) => Promise<T | undefined>;
} {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const go = useCallback(
    async (...args: Args) => {
      setBusy(true);
      setError(undefined);
      try {
        return await run(...args);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [run],
  );

  return { busy, error, clearError: useCallback(() => setError(undefined), []), go };
}

export function when(iso: string | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
