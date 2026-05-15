import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import { DbInternalStateStore } from '@openhermit/store';

async function createTestStore(t: import('node:test').TestContext) {
  const store = await DbInternalStateStore.open();
  t.after(() => store.close());
  return store;
}

const uniqueUserId = (): string => `usr-${randomUUID().slice(0, 8)}`;
const uniqueAgentId = (): string => `agent-test-${randomUUID().slice(0, 8)}`;
const uniqueChannelId = (): string => randomUUID().slice(0, 8);

test('UserStore: upsert and get a user', async (t) => {
  const store = await createTestStore(t);
  const users = store.users;
  const userId = uniqueUserId();
  const now = new Date().toISOString();

  await users.upsert({
    userId,
    name: 'Alice',
    createdAt: now,
    updatedAt: now,
  });

  const user = await users.get(userId);
  assert.ok(user);
  assert.equal(user.userId, userId);
  assert.equal(user.name, 'Alice');
});

test('UserStore: upsert updates existing user', async (t) => {
  const store = await createTestStore(t);
  const users = store.users;
  const userId = uniqueUserId();
  const now = new Date().toISOString();

  await users.upsert({ userId, createdAt: now, updatedAt: now });

  const later = new Date(Date.now() + 1000).toISOString();
  await users.upsert({ userId, name: 'Bob', createdAt: now, updatedAt: later });

  const user = await users.get(userId);
  assert.ok(user);
  assert.equal(user.name, 'Bob');
  assert.equal(user.updatedAt, later);
});

test('UserStore: list excludes merged users', async (t) => {
  const store = await createTestStore(t);
  const users = store.users;
  const a = uniqueUserId();
  const b = uniqueUserId();
  const c = uniqueUserId();
  const now = new Date().toISOString();

  await users.upsert({ userId: a, createdAt: now, updatedAt: now });
  await users.upsert({ userId: b, createdAt: now, updatedAt: now });
  await users.upsert({ userId: c, mergedInto: a, createdAt: now, updatedAt: now });

  const list = await users.list();
  const ids = list.map((u) => u.userId);
  assert.ok(ids.includes(a));
  assert.ok(ids.includes(b));
  assert.ok(!ids.includes(c));
});

test('UserStore: link and resolve identity', async (t) => {
  const store = await createTestStore(t);
  const users = store.users;
  const userId = uniqueUserId();
  const channelUserId = uniqueChannelId();
  const now = new Date().toISOString();

  await users.upsert({ userId, createdAt: now, updatedAt: now });
  await users.linkIdentity({
    userId,
    channel: 'telegram',
    channelUserId,
    createdAt: now,
  });

  const resolved = await users.resolve('telegram', channelUserId);
  assert.equal(resolved, userId);

  const unknown = await users.resolve('telegram', uniqueChannelId());
  assert.equal(unknown, undefined);
});

test('UserStore: resolve follows merged_into', async (t) => {
  const store = await createTestStore(t);
  const users = store.users;
  const a = uniqueUserId();
  const b = uniqueUserId();
  const channelUserId = uniqueChannelId();
  const now = new Date().toISOString();

  await users.upsert({ userId: a, createdAt: now, updatedAt: now });
  await users.upsert({ userId: b, createdAt: now, updatedAt: now });
  await users.linkIdentity({ userId: b, channel: 'telegram', channelUserId, createdAt: now });

  await users.merge(b, a);

  const resolved = await users.resolve('telegram', channelUserId);
  assert.equal(resolved, a);
});

test('UserStore: merge re-links identities', async (t) => {
  const store = await createTestStore(t);
  const users = store.users;
  const a = uniqueUserId();
  const b = uniqueUserId();
  const tg = uniqueChannelId();
  const dc = uniqueChannelId();
  const now = new Date().toISOString();

  await users.upsert({ userId: a, createdAt: now, updatedAt: now });
  await users.upsert({ userId: b, createdAt: now, updatedAt: now });
  await users.linkIdentity({ userId: b, channel: 'telegram', channelUserId: tg, createdAt: now });
  await users.linkIdentity({ userId: b, channel: 'discord', channelUserId: dc, createdAt: now });

  await users.merge(b, a);

  const identities = await users.listIdentities(a);
  assert.ok(identities.find((i) => i.channel === 'telegram' && i.channelUserId === tg));
  assert.ok(identities.find((i) => i.channel === 'discord' && i.channelUserId === dc));

  const oldIdentities = await users.listIdentities(b);
  assert.equal(oldIdentities.length, 0);
});

test('UserStore: unlink identity', async (t) => {
  const store = await createTestStore(t);
  const users = store.users;
  const userId = uniqueUserId();
  const channelUserId = uniqueChannelId();
  const now = new Date().toISOString();

  await users.upsert({ userId, createdAt: now, updatedAt: now });
  await users.linkIdentity({ userId, channel: 'telegram', channelUserId, createdAt: now });

  await users.unlinkIdentity('telegram', channelUserId);

  const resolved = await users.resolve('telegram', channelUserId);
  assert.equal(resolved, undefined);
});

test('UserStore: delete cascades identities', async (t) => {
  const store = await createTestStore(t);
  const users = store.users;
  const userId = uniqueUserId();
  const channelUserId = uniqueChannelId();
  const now = new Date().toISOString();

  await users.upsert({ userId, createdAt: now, updatedAt: now });
  await users.linkIdentity({ userId, channel: 'telegram', channelUserId, createdAt: now });

  await users.delete(userId);

  const user = await users.get(userId);
  assert.equal(user, undefined);

  const resolved = await users.resolve('telegram', channelUserId);
  assert.equal(resolved, undefined);
});

test('UserStore: linkIdentity re-links existing identity to new user', async (t) => {
  const store = await createTestStore(t);
  const users = store.users;
  const a = uniqueUserId();
  const b = uniqueUserId();
  const channelUserId = uniqueChannelId();
  const now = new Date().toISOString();

  await users.upsert({ userId: a, createdAt: now, updatedAt: now });
  await users.upsert({ userId: b, createdAt: now, updatedAt: now });
  await users.linkIdentity({ userId: b, channel: 'telegram', channelUserId, createdAt: now });

  await users.linkIdentity({ userId: a, channel: 'telegram', channelUserId, createdAt: now });

  const resolved = await users.resolve('telegram', channelUserId);
  assert.equal(resolved, a);
});

test('UserStore: assignAgent grants per-agent role and isolates between agents', async (t) => {
  const store = await createTestStore(t);
  const users = store.users;
  const userId = uniqueUserId();
  const agent1 = uniqueAgentId();
  const agent2 = uniqueAgentId();
  const now = new Date().toISOString();

  await users.upsert({ userId, createdAt: now, updatedAt: now });
  await users.assignAgent({ agentId: agent1 }, userId, 'owner', now);

  // Role exists on agent1, not on agent2.
  assert.equal(await users.getAgentRole({ agentId: agent1 }, userId), 'owner');
  assert.equal(await users.getAgentRole({ agentId: agent2 }, userId), undefined);

  // listByAgent reflects only members of that agent.
  const agent1Members = await users.listByAgent({ agentId: agent1 });
  assert.ok(agent1Members.find((m) => m.userId === userId && m.role === 'owner'));
  const agent2Members = await users.listByAgent({ agentId: agent2 });
  assert.ok(!agent2Members.find((m) => m.userId === userId));
});
