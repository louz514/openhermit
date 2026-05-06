import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildPrincipal,
  canAccess,
  matchesGrant,
  parseMcpServerId,
  resolveExecGrants,
  resolveFilePathGrants,
  resolveMcpGrants,
  resolveToolGrants,
  type Grant,
  type PolicyRow,
  type Principal,
  type ToolPolicy,
} from '../src/core/index.js';

// ── matchesGrant ────────────────────────────────────────────────────────

test('matchesGrant: {type:any} matches everyone', () => {
  const grant: Grant = { type: 'any' };
  assert.ok(matchesGrant({ agentId: 'a', role: 'guest' }, grant));
  assert.ok(matchesGrant({ agentId: 'a', role: 'owner' }, grant));
  assert.ok(matchesGrant({ agentId: 'a' }, grant));
});

test('matchesGrant: {type:role} matches only that role', () => {
  const grant: Grant = { type: 'role', value: 'user' };
  assert.ok(matchesGrant({ agentId: 'a', role: 'user' }, grant));
  assert.ok(!matchesGrant({ agentId: 'a', role: 'guest' }, grant));
  assert.ok(!matchesGrant({ agentId: 'a', role: 'owner' }, grant));
  assert.ok(!matchesGrant({ agentId: 'a' }, grant));
});

test('matchesGrant: {type:user} matches only that userId', () => {
  const grant: Grant = { type: 'user', value: 'u-123' };
  assert.ok(matchesGrant({ agentId: 'a', userId: 'u-123' }, grant));
  assert.ok(!matchesGrant({ agentId: 'a', userId: 'u-456' }, grant));
  assert.ok(!matchesGrant({ agentId: 'a' }, grant));
});

// ── canAccess ───────────────────────────────────────────────────────────

test('canAccess: returns true if any grant matches', () => {
  const principal: Principal = { agentId: 'a', role: 'user' };
  const grants: Grant[] = [
    { type: 'role', value: 'owner' },
    { type: 'role', value: 'user' },
  ];
  assert.ok(canAccess(principal, grants));
});

test('canAccess: returns false if no grant matches', () => {
  const principal: Principal = { agentId: 'a', role: 'guest' };
  const grants: Grant[] = [
    { type: 'role', value: 'owner' },
    { type: 'role', value: 'user' },
  ];
  assert.ok(!canAccess(principal, grants));
});

test('canAccess: empty grants array denies everyone', () => {
  assert.ok(!canAccess({ agentId: 'a', role: 'owner' }, []));
});

// ── Tools without declared policy default to open ───────────────────────

test('tools without declared policy default to open', () => {
  const grants = resolveToolGrants(undefined, 'some_random_tool');
  assert.ok(canAccess({ agentId: 'a', role: 'guest' }, grants));
});

// ── resolveToolGrants with policy rows ──────────────────────────────────

test('resolveToolGrants: DB row overrides default', () => {
  const rows: PolicyRow[] = [{
    agentId: 'a',
    resourceType: 'tool',
    scope: {},
    resourceKey: 'exec',
    grants: [{ type: 'any' }],
  }];
  const grants = resolveToolGrants(rows, 'exec');
  assert.ok(canAccess({ agentId: 'a', role: 'guest' }, grants));
});

test('resolveToolGrants: falls back to open when no row and no declared policy', () => {
  const rows: PolicyRow[] = [];
  const grants = resolveToolGrants(rows, 'exec');
  assert.ok(canAccess({ agentId: 'a', role: 'guest' }, grants));
});

// ── prefix matching ─────────────────────────────────────────────────────

test('resolveToolGrants: prefix pattern matches MCP tools', () => {
  const rows: PolicyRow[] = [{
    agentId: 'a',
    resourceType: 'tool',
    scope: {},
    resourceKey: 'mcp__weather__*',
    grants: [{ type: 'role', value: 'owner' }],
  }];
  const grants = resolveToolGrants(rows, 'mcp__weather__get_forecast');
  assert.ok(canAccess({ agentId: 'a', role: 'owner' }, grants));
  assert.ok(!canAccess({ agentId: 'a', role: 'guest' }, grants));
});

test('resolveToolGrants: prefix pattern does not match unrelated tools', () => {
  const rows: PolicyRow[] = [{
    agentId: 'a',
    resourceType: 'tool',
    scope: {},
    resourceKey: 'mcp__weather__*',
    grants: [{ type: 'role', value: 'owner' }],
  }];
  const grants = resolveToolGrants(rows, 'mcp__calendar__list');
  // No match → falls back to OPEN
  assert.ok(canAccess({ agentId: 'a', role: 'guest' }, grants));
});

test('resolveToolGrants: exact match takes priority over prefix', () => {
  const rows: PolicyRow[] = [
    {
      agentId: 'a', resourceType: 'tool', scope: {},
      resourceKey: 'mcp__weather__*',
      grants: [{ type: 'role', value: 'owner' }],
    },
    {
      agentId: 'a', resourceType: 'tool', scope: {},
      resourceKey: 'mcp__weather__public_status',
      grants: [{ type: 'any' }],
    },
  ];
  // Exact match → open to everyone
  const grants = resolveToolGrants(rows, 'mcp__weather__public_status');
  assert.ok(canAccess({ agentId: 'a', role: 'guest' }, grants));
  // Other tools in same prefix → owner only
  const grants2 = resolveToolGrants(rows, 'mcp__weather__get_forecast');
  assert.ok(!canAccess({ agentId: 'a', role: 'guest' }, grants2));
});

// ── buildPrincipal ──────────────────────────────────────────────────────

test('buildPrincipal omits undefined fields', () => {
  const p = buildPrincipal('agent-1');
  assert.equal(p.agentId, 'agent-1');
  assert.equal(p.userId, undefined);
  assert.equal(p.role, undefined);
});

test('buildPrincipal includes provided fields', () => {
  const p = buildPrincipal('agent-1', 'user-1', 'owner');
  assert.equal(p.agentId, 'agent-1');
  assert.equal(p.userId, 'user-1');
  assert.equal(p.role, 'owner');
});

// ── fixed vs configurable ToolPolicy ────────────────────────────────────

test('resolveToolGrants: fixed policy ignores DB rows', () => {
  const fixedPolicy: ToolPolicy = { kind: 'fixed', grants: [{ type: 'role', value: 'owner' }] };
  const rows: PolicyRow[] = [{
    agentId: 'a',
    resourceType: 'tool',
    scope: {},
    resourceKey: 'my_tool',
    grants: [{ type: 'any' }],
  }];
  const grants = resolveToolGrants(rows, 'my_tool', fixedPolicy);
  // Fixed policy should NOT be overridden by DB row
  assert.ok(!canAccess({ agentId: 'a', role: 'guest' }, grants));
  assert.ok(canAccess({ agentId: 'a', role: 'owner' }, grants));
});

test('resolveToolGrants: configurable policy uses DB row when present', () => {
  const configurablePolicy: ToolPolicy = {
    kind: 'configurable',
    defaultGrants: [{ type: 'role', value: 'owner' }],
  };
  const rows: PolicyRow[] = [{
    agentId: 'a',
    resourceType: 'tool',
    scope: {},
    resourceKey: 'my_tool',
    grants: [{ type: 'any' }],
  }];
  const grants = resolveToolGrants(rows, 'my_tool', configurablePolicy);
  // DB row should override the default
  assert.ok(canAccess({ agentId: 'a', role: 'guest' }, grants));
});

test('resolveToolGrants: configurable policy falls back to defaultGrants', () => {
  const configurablePolicy: ToolPolicy = {
    kind: 'configurable',
    defaultGrants: [{ type: 'role', value: 'owner' }],
  };
  const grants = resolveToolGrants([], 'my_tool', configurablePolicy);
  assert.ok(!canAccess({ agentId: 'a', role: 'guest' }, grants));
  assert.ok(canAccess({ agentId: 'a', role: 'owner' }, grants));
});

// ── resolveFilePathGrants ─────────────────────────────────────────────

test('resolveFilePathGrants: returns undefined when no file rows', () => {
  assert.equal(resolveFilePathGrants([], 'primary', 'read', '/workspace/foo.txt'), undefined);
});

test('resolveFilePathGrants: matches path prefix', () => {
  const rows: PolicyRow[] = [{
    agentId: 'a', resourceType: 'file', resourceKey: 'primary:read:/workspace/',
    grants: [{ type: 'role', value: 'user' }],
    scope: { sandbox: 'primary', mode: 'read', path: '/workspace/' },
  }];
  const grants = resolveFilePathGrants(rows, 'primary', 'read', '/workspace/foo.txt');
  assert.deepEqual(grants, [{ type: 'role', value: 'user' }]);
});

test('resolveFilePathGrants: longest prefix wins', () => {
  const rows: PolicyRow[] = [
    {
      agentId: 'a', resourceType: 'file', resourceKey: 'primary:read:/workspace/',
      grants: [{ type: 'any' }],
      scope: { sandbox: 'primary', mode: 'read', path: '/workspace/' },
    },
    {
      agentId: 'a', resourceType: 'file', resourceKey: 'primary:read:/workspace/private/',
      grants: [{ type: 'role', value: 'owner' }],
      scope: { sandbox: 'primary', mode: 'read', path: '/workspace/private/' },
    },
  ];
  const g1 = resolveFilePathGrants(rows, 'primary', 'read', '/workspace/public/x');
  assert.deepEqual(g1, [{ type: 'any' }]);
  const g2 = resolveFilePathGrants(rows, 'primary', 'read', '/workspace/private/secret.txt');
  assert.deepEqual(g2, [{ type: 'role', value: 'owner' }]);
});

test('resolveFilePathGrants: wildcard sandbox matches any', () => {
  const rows: PolicyRow[] = [{
    agentId: 'a', resourceType: 'file', resourceKey: '*:read:/workspace/',
    grants: [{ type: 'any' }],
    scope: { sandbox: '*', mode: 'read', path: '/workspace/' },
  }];
  const grants = resolveFilePathGrants(rows, 'whatever', 'read', '/workspace/foo.txt');
  assert.deepEqual(grants, [{ type: 'any' }]);
});

test('resolveFilePathGrants: mode must match', () => {
  const rows: PolicyRow[] = [{
    agentId: 'a', resourceType: 'file', resourceKey: 'primary:read:/workspace/',
    grants: [{ type: 'any' }],
    scope: { sandbox: 'primary', mode: 'read', path: '/workspace/' },
  }];
  const grants = resolveFilePathGrants(rows, 'primary', 'write', '/workspace/foo.txt');
  assert.deepEqual(grants, []);
});

test('resolveFilePathGrants: no matching path denies', () => {
  const rows: PolicyRow[] = [{
    agentId: 'a', resourceType: 'file', resourceKey: 'primary:read:/workspace/public/',
    grants: [{ type: 'any' }],
    scope: { sandbox: 'primary', mode: 'read', path: '/workspace/public/' },
  }];
  const grants = resolveFilePathGrants(rows, 'primary', 'read', '/workspace/private/foo.txt');
  assert.deepEqual(grants, []);
});

// ── resolveExecGrants ─────────────────────────────────────────────────

test('resolveExecGrants: returns undefined when no exec rows', () => {
  assert.equal(resolveExecGrants([], 'primary', 'git status'), undefined);
});

test('resolveExecGrants: wildcard command allows anything', () => {
  const rows: PolicyRow[] = [{
    agentId: 'a', resourceType: 'exec', resourceKey: 'primary:*',
    grants: [{ type: 'role', value: 'owner' }],
    scope: { sandbox: 'primary', command: '*' },
  }];
  const grants = resolveExecGrants(rows, 'primary', 'rm -rf /');
  assert.deepEqual(grants, [{ type: 'role', value: 'owner' }]);
});

test('resolveExecGrants: exact command match', () => {
  const rows: PolicyRow[] = [{
    agentId: 'a', resourceType: 'exec', resourceKey: 'primary:git status',
    grants: [{ type: 'any' }],
    scope: { sandbox: 'primary', command: 'git status' },
  }];
  const grants = resolveExecGrants(rows, 'primary', 'git status');
  assert.deepEqual(grants, [{ type: 'any' }]);
});

test('resolveExecGrants: normalizes whitespace', () => {
  const rows: PolicyRow[] = [{
    agentId: 'a', resourceType: 'exec', resourceKey: 'primary:git status',
    grants: [{ type: 'any' }],
    scope: { sandbox: 'primary', command: 'git status' },
  }];
  const grants = resolveExecGrants(rows, 'primary', '  git  status  ');
  assert.deepEqual(grants, [{ type: 'any' }]);
});

test('resolveExecGrants: different command denied', () => {
  const rows: PolicyRow[] = [{
    agentId: 'a', resourceType: 'exec', resourceKey: 'primary:git status',
    grants: [{ type: 'any' }],
    scope: { sandbox: 'primary', command: 'git status' },
  }];
  const grants = resolveExecGrants(rows, 'primary', 'git push');
  assert.deepEqual(grants, []);
});

test('resolveExecGrants: wildcard sandbox matches any', () => {
  const rows: PolicyRow[] = [{
    agentId: 'a', resourceType: 'exec', resourceKey: '*:*',
    grants: [{ type: 'role', value: 'owner' }],
    scope: { sandbox: '*', command: '*' },
  }];
  const grants = resolveExecGrants(rows, 'any-sandbox', 'ls');
  assert.deepEqual(grants, [{ type: 'role', value: 'owner' }]);
});

test('resolveExecGrants: sandbox mismatch denied', () => {
  const rows: PolicyRow[] = [{
    agentId: 'a', resourceType: 'exec', resourceKey: 'primary:git status',
    grants: [{ type: 'any' }],
    scope: { sandbox: 'primary', command: 'git status' },
  }];
  const grants = resolveExecGrants(rows, 'other', 'git status');
  assert.deepEqual(grants, []);
});

// ── resolveExecGrants: cwd scoping ──────────────────────────────────

test('resolveExecGrants: rows without cwd match any cwd', () => {
  const rows: PolicyRow[] = [{
    agentId: 'a', resourceType: 'exec', resourceKey: 'primary:*',
    grants: [{ type: 'role', value: 'owner' }],
    scope: { sandbox: 'primary', command: '*' },
  }];
  const grants = resolveExecGrants(rows, 'primary', 'ls', '/workspace/project');
  assert.deepEqual(grants, [{ type: 'role', value: 'owner' }]);
});

test('resolveExecGrants: cwd prefix match', () => {
  const rows: PolicyRow[] = [{
    agentId: 'a', resourceType: 'exec', resourceKey: 'primary:/workspace/:*',
    grants: [{ type: 'any' }],
    scope: { sandbox: 'primary', command: '*', cwd: '/workspace/' },
  }];
  const grants = resolveExecGrants(rows, 'primary', 'npm test', '/workspace/project');
  assert.deepEqual(grants, [{ type: 'any' }]);
});

test('resolveExecGrants: cwd mismatch denied', () => {
  const rows: PolicyRow[] = [{
    agentId: 'a', resourceType: 'exec', resourceKey: 'primary:/workspace/:*',
    grants: [{ type: 'any' }],
    scope: { sandbox: 'primary', command: '*', cwd: '/workspace/' },
  }];
  const grants = resolveExecGrants(rows, 'primary', 'ls', '/etc');
  assert.deepEqual(grants, []);
});

test('resolveExecGrants: cwd-scoped row wins over no-cwd row', () => {
  const rows: PolicyRow[] = [
    {
      agentId: 'a', resourceType: 'exec', resourceKey: 'primary:*',
      grants: [{ type: 'role', value: 'owner' }],
      scope: { sandbox: 'primary', command: '*' },
    },
    {
      agentId: 'a', resourceType: 'exec', resourceKey: 'primary:/workspace/:*',
      grants: [{ type: 'any' }],
      scope: { sandbox: 'primary', command: '*', cwd: '/workspace/' },
    },
  ];
  // cwd-scoped row is more specific
  const g1 = resolveExecGrants(rows, 'primary', 'ls', '/workspace/project');
  assert.deepEqual(g1, [{ type: 'any' }]);
  // Outside cwd scope, falls back to no-cwd row
  const g2 = resolveExecGrants(rows, 'primary', 'ls', '/etc');
  assert.deepEqual(g2, [{ type: 'role', value: 'owner' }]);
});

test('resolveExecGrants: exact command + cwd beats wildcard command + cwd', () => {
  const rows: PolicyRow[] = [
    {
      agentId: 'a', resourceType: 'exec', resourceKey: 'primary:/workspace/:*',
      grants: [{ type: 'role', value: 'owner' }],
      scope: { sandbox: 'primary', command: '*', cwd: '/workspace/' },
    },
    {
      agentId: 'a', resourceType: 'exec', resourceKey: 'primary:/workspace/:npm test',
      grants: [{ type: 'any' }],
      scope: { sandbox: 'primary', command: 'npm test', cwd: '/workspace/' },
    },
  ];
  const g1 = resolveExecGrants(rows, 'primary', 'npm test', '/workspace/project');
  assert.deepEqual(g1, [{ type: 'any' }]);
  const g2 = resolveExecGrants(rows, 'primary', 'rm -rf /', '/workspace/project');
  assert.deepEqual(g2, [{ type: 'role', value: 'owner' }]);
});

test('resolveExecGrants: cwd scope skipped when no cwd provided', () => {
  const rows: PolicyRow[] = [
    {
      agentId: 'a', resourceType: 'exec', resourceKey: 'primary:*',
      grants: [{ type: 'role', value: 'owner' }],
      scope: { sandbox: 'primary', command: '*' },
    },
    {
      agentId: 'a', resourceType: 'exec', resourceKey: 'primary:/workspace/:*',
      grants: [{ type: 'any' }],
      scope: { sandbox: 'primary', command: '*', cwd: '/workspace/' },
    },
  ];
  // No cwd passed → cwd-scoped row is skipped
  const grants = resolveExecGrants(rows, 'primary', 'ls');
  assert.deepEqual(grants, [{ type: 'role', value: 'owner' }]);
});

// ── parseMcpServerId ─────────────────────────────────────────────────

test('parseMcpServerId: extracts server ID from mcp tool name', () => {
  assert.equal(parseMcpServerId('mcp__weather__get_forecast'), 'weather');
  assert.equal(parseMcpServerId('mcp__my-server__tool'), 'my-server');
});

test('parseMcpServerId: returns undefined for non-MCP tools', () => {
  assert.equal(parseMcpServerId('exec'), undefined);
  assert.equal(parseMcpServerId('file_read'), undefined);
  assert.equal(parseMcpServerId('mcp_status'), undefined);
});

test('parseMcpServerId: returns undefined for malformed MCP names', () => {
  assert.equal(parseMcpServerId('mcp__noseparator'), undefined);
});

// ── resolveMcpGrants ─────────────────────────────────────────────────

test('resolveMcpGrants: returns undefined when no mcp rows', () => {
  assert.equal(resolveMcpGrants([], 'weather'), undefined);
});

test('resolveMcpGrants: exact server match', () => {
  const rows: PolicyRow[] = [{
    agentId: 'a', resourceType: 'mcp', resourceKey: 'weather',
    grants: [{ type: 'role', value: 'owner' }],
    scope: {},
  }];
  assert.deepEqual(resolveMcpGrants(rows, 'weather'), [{ type: 'role', value: 'owner' }]);
});

test('resolveMcpGrants: wildcard matches any server', () => {
  const rows: PolicyRow[] = [{
    agentId: 'a', resourceType: 'mcp', resourceKey: '*',
    grants: [{ type: 'any' }],
    scope: {},
  }];
  assert.deepEqual(resolveMcpGrants(rows, 'anything'), [{ type: 'any' }]);
});

test('resolveMcpGrants: exact match takes priority over wildcard', () => {
  const rows: PolicyRow[] = [
    {
      agentId: 'a', resourceType: 'mcp', resourceKey: '*',
      grants: [{ type: 'any' }],
      scope: {},
    },
    {
      agentId: 'a', resourceType: 'mcp', resourceKey: 'secret-server',
      grants: [{ type: 'role', value: 'owner' }],
      scope: {},
    },
  ];
  assert.deepEqual(resolveMcpGrants(rows, 'secret-server'), [{ type: 'role', value: 'owner' }]);
  assert.deepEqual(resolveMcpGrants(rows, 'other-server'), [{ type: 'any' }]);
});

test('resolveMcpGrants: no matching server denied', () => {
  const rows: PolicyRow[] = [{
    agentId: 'a', resourceType: 'mcp', resourceKey: 'weather',
    grants: [{ type: 'any' }],
    scope: {},
  }];
  assert.deepEqual(resolveMcpGrants(rows, 'calendar'), []);
});
