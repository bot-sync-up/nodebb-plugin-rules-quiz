'use strict';

/**
 * Per-key async lock (no NodeBB dependencies, so it is unit-testable).
 *
 * The write gate reads a user's single-use token, decides, and consumes it.
 * Two concurrent submits from the same user (e.g. two tabs) must not both see
 * the same token. Running each user's gate check through withUserLock makes
 * read-check-consume atomic within this process. Different keys run in
 * parallel; the same key runs strictly in call order.
 */

const locks = new Map();

async function withUserLock(key, fn) {
  const k = String(key);
  const prev = locks.get(k) || Promise.resolve();
  let release;
  const mine = new Promise((resolve) => { release = resolve; });
  const tail = prev.then(() => mine);
  locks.set(k, tail);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(k) === tail) locks.delete(k);
  }
}

/** Number of keys currently holding or waiting on a lock (for tests). */
function activeLockCount() {
  return locks.size;
}

module.exports = { withUserLock, activeLockCount };
