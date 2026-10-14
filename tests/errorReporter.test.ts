import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ns from '../src/utils/errorReporter';

const m: any = (ns as any).default ?? ns;
const now = () => new Date('2026-01-01T00:00:00Z');
const mk = (sent: any[]) => m.createReporter({ send: (r: any) => sent.push(r), path: () => '/account/orders/abc?token=SECRET#x', userAgent: 'UA', now });

test('scrub removes emails, long digit runs and query strings', () => {
  const s = m.scrub('fail for a.b@x.com phone 9876543210 at https://x.com/p?order=123&k=v');
  assert.ok(!s.includes('a.b@x.com'));
  assert.ok(!s.includes('9876543210'));
  assert.ok(!s.includes('order=123'));
});

test('report keeps only the path (no query/hash) and no extra fields', () => {
  const sent: any[] = [];
  mk(sent)(new Error('boom'));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].path, '/account/orders/abc');
  assert.deepEqual(Object.keys(sent[0]).sort(), ['message', 'path', 'stack', 'time', 'userAgent']);
});

test('identical errors are deduped and reports are capped per page', () => {
  const sent: any[] = [];
  const r = mk(sent);
  const same = new Error('same'); // a real duplicate comes from one throw site (same stack)
  assert.equal(r(same), true);
  assert.equal(r(same), false);
  for (let i = 0; i < 20; i++) r(new Error('e' + i));
  assert.equal(sent.length, 5);
});

test('a failing sender never throws into the app', () => {
  const r = m.createReporter({ send: () => { throw new Error('net'); }, path: () => '/', userAgent: 'UA', now });
  assert.equal(r(new Error('x')), false);
});

test('installErrorReporter is a no-op without an https endpoint', () => {
  assert.doesNotThrow(() => m.installErrorReporter(undefined));
  assert.doesNotThrow(() => m.installErrorReporter('http://insecure.example'));
});
