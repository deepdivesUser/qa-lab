import { test, expect, type APIRequestContext } from '@playwright/test';
import { ACTORS, MATRIX, type ActorId } from '../src/matrix.ts';
import { login, bearer } from '../../e2e/fixtures/api.ts';

/**
 * Walks the full access matrix: every protected endpoint × every actor.
 * Each cell is its own test, so a regression report names the exact door
 * that opened — not just "isolation broke".
 */
const tokens = new Map<ActorId, string>();

async function tokenFor(request: APIRequestContext, actor: ActorId): Promise<string | null> {
  if (actor === 'anon') return null;
  if (!tokens.has(actor)) {
    tokens.set(actor, await login(request, ACTORS[actor]!.email!));
  }
  return tokens.get(actor) ?? null;
}

for (const row of MATRIX) {
  test.describe(`${row.route} [${row.path}]`, () => {
    for (const [actor, expected] of Object.entries(row.expected) as Array<[ActorId, number]>) {
      test(`${actor} → ${expected}`, async ({ request }) => {
        const token = await tokenFor(request, actor);
        const res = await request.fetch(row.path, {
          method: row.method,
          data: row.body,
          headers: token ? bearer(token) : {},
        });
        expect(
          res.status(),
          `${row.method} ${row.path} as ${actor} (${ACTORS[actor]!.org}/${ACTORS[actor]!.role})`,
        ).toBe(expected);
      });
    }
  });
}

test('matrix is exhaustive: every actor has an expectation for every row', () => {
  const actorIds = Object.keys(ACTORS) as ActorId[];
  for (const row of MATRIX) {
    expect.soft(Object.keys(row.expected).sort(), `${row.route} covers all actors`).toEqual(
      [...actorIds].sort(),
    );
  }
});
