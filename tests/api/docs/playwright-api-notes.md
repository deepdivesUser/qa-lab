# Playwright API Testing - Getting Started

## 1. Init project & install

```bash
yarn init -y
yarn add -D @playwright/test
```

## 2. Create config

Create `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
});
```

## 3. Write your first test

Create `tests/api.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('GET example', async ({ request }) => {
  const response = await request.get('https://jsonplaceholder.typicode.com/posts/1');

  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.id).toBe(1);
});

test('POST example', async ({ request }) => {
  const response = await request.post('https://jsonplaceholder.typicode.com/posts', {
    data: {
      title: 'foo',
      body: 'bar',
      userId: 1,
    },
  });

  expect(response.status()).toBe(201);

  const body = await response.json();
  expect(body.title).toBe('foo');
});
```

## 4. Run tests

```bash
yarn playwright test
```

Run a specific file:

```bash
yarn playwright test tests/api.spec.ts
```

Run with verbose output:

```bash
yarn playwright test --reporter=list
```

## Key `request` methods

| Method | Usage |
|--------|-------|
| `request.get(url)` | GET request |
| `request.post(url, { data })` | POST with JSON body |
| `request.put(url, { data })` | PUT with JSON body |
| `request.patch(url, { data })` | PATCH with JSON body |
| `request.delete(url)` | DELETE request |
| `request.fetch(url, { method, data })` | Generic |

## Useful assertions

```ts
expect(response.status()).toBe(200);
expect(response.ok()).toBeTruthy();          // status 200-299
expect(response.headers()['content-type']).toContain('application/json');

const body = await response.json();
expect(body).toMatchObject({ id: 1 });      // partial match
expect(body).toEqual({ id: 1, title: 'x' }); // exact match
```

## POISED Testing Strategy

From Test Automation University — a structured framework for thorough API testing.

| Letter | Focus | Key Question |
|---|---|---|
| **P** | Parameters | Are all inputs handled correctly? |
| **O** | Output | Is the response shape and status correct? |
| **I** | Interop | Does it play well with other systems? |
| **S** | Security | Is access properly controlled? |
| **E** | Errors | Are failures handled gracefully and consistently? |
| **D** | Data | Is state managed correctly across operations? |

---

### P — Parameters

Testing all the inputs your API accepts — path params, query params, headers, and request body fields.

**What to check:**
- Valid values (happy path)
- Missing required params → expect 400/422
- Invalid types (string where int expected)
- Boundary values (0, -1, max length, empty string)
- Unexpected/extra parameters

```typescript
import { test, expect } from '@playwright/test';

const paramTests = [
  { label: 'valid id',    id: '1',   expected: 200 },
  { label: 'string id',   id: 'abc', expected: 400 },
  { label: 'negative id', id: '-1',  expected: 400 },
  { label: 'missing id',  id: '',    expected: 404 },
];

for (const { label, id, expected } of paramTests) {
  test(`GET /users - ${label}`, async ({ request }) => {
    const response = await request.get(`/users/${id}`);
    expect(response.status()).toBe(expected);
  });
}
```

---

### O — Output

Validating what the API returns — status codes, response body shape, headers, and data types.

**What to check:**
- Correct status code for each scenario
- Response body matches expected contract/schema
- Correct `Content-Type` header returned
- No sensitive data leaked in responses
- Consistent field naming (camelCase vs snake_case)

```typescript
test('GET /users/:id output matches contract', async ({ request }) => {
  const response = await request.get('/users/1');

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');

  const body = await response.json();
  expect(body).toMatchObject({
    id: expect.any(Number),
    email: expect.stringContaining('@'),
    name: expect.any(String),
    createdAt: expect.any(String),
  });
});
```

---

### I — Interop

How your API works with other systems — integrations, third-party services, and other internal APIs.

**What to check:**
- Does the API correctly consume upstream services?
- Does it handle upstream failures gracefully?
- Are data formats compatible across service boundaries?
- Contract testing between services (consumer/provider)

```typescript
test('order service handles payment service being down', async ({ request }) => {
  const response = await request.post('/orders', {
    data: { itemId: 1, quantity: 2 },
    headers: { 'X-Mock-Payment-Service': 'down' }
  });

  // Should degrade gracefully, not 500
  expect(response.status()).toBe(503);
  const body = await response.json();
  expect(body).toHaveProperty('error');
  expect(body.error).toMatch(/payment service unavailable/i);
});
```

---

### S — Security

Ensuring the API enforces authentication, authorization, and doesn't expose vulnerabilities.

**What to check:**
- No token → 401
- Expired/invalid token → 401
- Valid token, wrong role → 403
- Can a user access another user's data? (IDOR)
- Sensitive data not returned unnecessarily (passwords, tokens)

```typescript
test.describe('Security coverage', () => {
  test('returns 401 with no token', async ({ request }) => {
    const response = await request.get('/account/settings');
    expect(response.status()).toBe(401);
  });

  test('user cannot access another users data (IDOR)', async ({ request }) => {
    const response = await request.get('/users/1/profile', {
      headers: { Authorization: `Bearer ${process.env.USER_2_TOKEN}` }
    });
    expect(response.status()).toBe(403);
  });

  test('password not returned in user response', async ({ request }) => {
    const response = await request.get('/users/1', {
      headers: { Authorization: `Bearer ${process.env.ADMIN_TOKEN}` }
    });
    const body = await response.json();
    expect(body).not.toHaveProperty('password');
    expect(body).not.toHaveProperty('passwordHash');
  });
});
```

---

### E — Errors

Verifying the API handles failures predictably and returns useful, consistent error responses.

**What to check:**
- Error messages are clear and actionable (not stack traces)
- Consistent error response shape across all endpoints
- Correct status codes for each error type
- No generic 500s where a 4xx is appropriate

```typescript
test('error responses follow consistent shape', async ({ request }) => {
  const response = await request.post('/users', {
    data: { email: 'notvalid' }
  });

  expect(response.status()).toBe(422);
  const body = await response.json();

  expect(body).toMatchObject({
    error: expect.any(String),
    message: expect.any(String),
    statusCode: expect.any(Number),
  });

  // No stack traces leaked
  expect(JSON.stringify(body)).not.toMatch(/at Object\./);
  expect(JSON.stringify(body)).not.toMatch(/node_modules/);
});
```

---

### D — Data

Testing how the API creates, reads, updates, and deletes data — and whether state is managed correctly.

**What to check:**
- CRUD operations work end-to-end
- Data persists correctly after writes
- Deletes are actually removed (or soft-deleted as expected)
- Concurrent writes don't corrupt state
- Pagination, filtering, and sorting work correctly

```typescript
test('full CRUD lifecycle for a resource', async ({ request }) => {
  // CREATE
  const created = await request.post('/items', {
    data: { name: 'Test Item', price: 9.99 }
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();

  // READ
  const fetched = await request.get(`/items/${id}`);
  expect(fetched.status()).toBe(200);
  const item = await fetched.json();
  expect(item.name).toBe('Test Item');

  // UPDATE
  const updated = await request.patch(`/items/${id}`, {
    data: { price: 14.99 }
  });
  expect(updated.status()).toBe(200);

  // DELETE
  const deleted = await request.delete(`/items/${id}`);
  expect(deleted.status()).toBe(204);

  // VERIFY GONE
  const gone = await request.get(`/items/${id}`);
  expect(gone.status()).toBe(404);
});
```

---