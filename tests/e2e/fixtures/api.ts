/**
 * API-driven fixtures — helpers that create session state through the real
 * API rather than hand-writing rows. A login here exercises the same code
 * path production would, so fixtures double as smoke coverage.
 */
import { expect, type APIRequestContext } from '@playwright/test';

export interface AuthedUser {
  id: number;
  email: string;
  name: string;
  role: 'operator' | 'viewer';
  org: { id: number; name: string };
}

export interface LoginResponse {
  token: string;
  user: AuthedUser;
}

export async function login(request: APIRequestContext, email: string): Promise<string> {
  const res = await request.post('/auth/login', { data: { email } });
  expect(res.ok(), `login should succeed for ${email}`).toBeTruthy();
  return ((await res.json()) as LoginResponse).token;
}

export async function createEvent(
  request: APIRequestContext,
  token: string,
  input: { name: string; startsAt: string },
): Promise<{ id: number; name: string; status: string; starts_at: string }> {
  const res = await request.post('/events', {
    data: input,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status(), `createEvent(${input.name}) should be 201`).toBe(201);
  return (await res.json()) as { id: number; name: string; status: string; starts_at: string };
}

export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
