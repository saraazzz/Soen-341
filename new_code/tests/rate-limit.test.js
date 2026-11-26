const { createRateLimiter } = require('../server/ai/rate-limit');

function setup(max = 3, windowMs = 60_000) {
  let t = 1_000_000;
  const limiter = createRateLimiter({ max, windowMs, now: () => t });
  return { limiter, advance: (ms) => { t += ms; } };
}

test('allows up to max requests then blocks with a retry time', () => {
  const { limiter } = setup(3, 60_000);
  expect(limiter.take('u1')).toMatchObject({ allowed: true, remaining: 2 });
  expect(limiter.take('u1')).toMatchObject({ allowed: true, remaining: 1 });
  expect(limiter.take('u1')).toMatchObject({ allowed: true, remaining: 0 });
  expect(limiter.take('u1')).toMatchObject({ allowed: false, remaining: 0, retryAfterSec: 60 });
});

test('users are limited separately', () => {
  const { limiter } = setup(1);
  expect(limiter.take('u1').allowed).toBe(true);
  expect(limiter.take('u1').allowed).toBe(false);
  expect(limiter.take('u2').allowed).toBe(true);
});

test('allowance comes back as old requests leave the window', () => {
  const { limiter, advance } = setup(2, 60_000);
  limiter.take('u1');
  advance(30_000);
  limiter.take('u1');
  expect(limiter.take('u1')).toMatchObject({ allowed: false, retryAfterSec: 30 });
  advance(31_000); // the first request is now older than the window
  expect(limiter.take('u1').allowed).toBe(true);
});

test('blocked attempts do not extend the wait', () => {
  const { limiter, advance } = setup(1, 60_000);
  limiter.take('u1');
  advance(10_000);
  expect(limiter.take('u1').retryAfterSec).toBe(50);
  advance(10_000);
  expect(limiter.take('u1').retryAfterSec).toBe(40);
});

test('reset clears all counters', () => {
  const { limiter } = setup(1);
  limiter.take('u1');
  limiter.reset();
  expect(limiter.take('u1').allowed).toBe(true);
});
