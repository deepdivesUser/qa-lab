import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv, type ValidateFunction } from 'ajv';
import { USERS } from '../../e2e/fixtures/users.ts';
import { login, bearer } from '../../e2e/fixtures/api.ts';

/**
 * Schema-drift guard: live responses must validate against the checked-in
 * contracts in ./contracts. When an endpoint changes shape on purpose, the
 * contract changes in the same commit — so a client built against yesterday's
 * API can diff the contracts, not the runtime. This is the drift tripwire.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const contracts = new Map<string, ValidateFunction>();

for (const name of ['health', 'error', 'login-200', 'events-200']) {
  const schema = JSON.parse(
    readFileSync(path.join(here, '..', 'contracts', `${name}.schema.json`), 'utf8'),
  );
  const ajv = new Ajv({ allErrors: true });
  contracts.set(name, ajv.compile(schema));
}

function validate(name: string, body: unknown, context: string) {
  const validateFn = contracts.get(name)!;
  const ok = validateFn(body);
  expect(
    ok,
    `${context} must match contract "${name}": ${JSON.stringify(validateFn.errors ?? [])}`,
  ).toBe(true);
}

test('contract: GET /health', async ({ request }) => {
  const res = await request.get('/health');
  expect(res.status()).toBe(200);
  validate('health', await res.json(), 'GET /health');
});

test('contract: POST /auth/login 200 + error bodies on 400/401', async ({ request }) => {
  const ok = await request.post('/auth/login', { data: { email: USERS.opAcme.email } });
  expect(ok.status()).toBe(200);
  validate('login-200', await ok.json(), 'login success');

  const bad = await request.post('/auth/login', { data: {} });
  expect(bad.status()).toBe(400);
  validate('error', await bad.json(), 'login 400');

  const unknown = await request.post('/auth/login', { data: { email: 'nobody@nowhere.test' } });
  expect(unknown.status()).toBe(401);
  validate('error', await unknown.json(), 'login 401');
});

test('contract: GET /events 200', async ({ request }) => {
  const token = await login(request, USERS.opAcme.email);
  const res = await request.get('/events', { headers: bearer(token) });
  expect(res.status()).toBe(200);
  validate('events-200', await res.json(), 'GET /events');
});

test('contract: unauthorized /events is the standard error body', async ({ request }) => {
  const res = await request.get('/events');
  expect(res.status()).toBe(401);
  validate('error', await res.json(), 'GET /events 401');
});
