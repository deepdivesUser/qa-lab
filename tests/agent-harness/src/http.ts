/** Minimal HTTP client for probes — plain fetch, no test-framework coupling. */
export interface ApiResponse {
  status: number;
  text: string;
  json(): Promise<unknown>;
}

export interface Api {
  get(path: string, token?: string): Promise<ApiResponse>;
  post(path: string, body: unknown, token?: string): Promise<ApiResponse>;
  patch(path: string, body: unknown, token?: string): Promise<ApiResponse>;
}

export function apiFor(base: string): Api {
  const call = async (method: string, path: string, body?: unknown, token?: string) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text(); // read once; json() parses the cache
    return {
      status: res.status,
      text,
      json: () => Promise.resolve(JSON.parse(text)),
    };
  };
  return {
    get: (p, t) => call('GET', p, undefined, t),
    post: (p, b, t) => call('POST', p, b, t),
    patch: (p, b, t) => call('PATCH', p, b, t),
  };
}

// --- assert helpers: a probe fails by throwing, and the message is the report ---
export function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function checkEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export async function login(api: Api, email: string): Promise<string> {
  const res = await api.post('/auth/login', { email });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`);
  const body = (await res.json()) as { token: string };
  return body.token;
}
