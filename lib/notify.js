'use strict';

/**
 * Notification + group-membership side effects.
 * Wraps NodeBB internals to keep controllers free of `require.main.require` calls.
 */

const winston = (() => {
  try { return require.main.require('winston'); }
  catch (e) { return { warn: console.warn, error: console.error }; }
})();

function lazy(name) {
  let cached;
  return () => {
    if (cached) return cached;
    try { cached = require.main.require(name); return cached; }
    catch (e) { return null; }
  };
}

const getNotifications = lazy('./src/notifications');
const getUser = lazy('./src/user');
const getGroups = lazy('./src/groups');

/**
 * Send a "welcome / passed" notification to the user.
 */
async function notifyUserPassed(uid) {
  const notifications = getNotifications();
  if (!notifications) return;
  try {
    const notif = await notifications.create({
      bodyShort: '[[rulesquiz:notify.welcome]]',
      nid: 'rulesquiz:passed:' + uid,
      from: 1,
      path: '/',
    });
    if (notif) await notifications.push(notif, [uid]);
  } catch (e) {
    winston.warn('[rules-quiz] notifyUserPassed failed: ' + e.message);
  }
}

/**
 * Tell every administrator that a user has failed the quiz N times.
 */
async function notifyAdminsRepeatedFails(uid, attemptCount) {
  const notifications = getNotifications();
  const groups = getGroups();
  if (!notifications || !groups) return;
  try {
    const adminUids = await groups.getMembers('administrators', 0, -1);
    if (!adminUids || !adminUids.length) return;
    const notif = await notifications.create({
      bodyShort: '[[rulesquiz:notify.failed_attempts, ' + uid + ', ' + attemptCount + ']]',
      nid: 'rulesquiz:fails:' + uid + ':' + attemptCount,
      from: 1,
      path: '/admin/plugins/rules-quiz',
    });
    if (notif) await notifications.push(notif, adminUids.map(Number).filter(Boolean));
  } catch (e) {
    winston.warn('[rules-quiz] notifyAdminsRepeatedFails failed: ' + e.message);
  }
}

/**
 * Add the user to a group on success (e.g. "verified-rules"). No-op if name is empty.
 */
async function addUserToSuccessGroup(uid, groupName) {
  if (!groupName) return;
  const groups = getGroups();
  if (!groups) return;
  try {
    const exists = await groups.exists(groupName);
    if (!exists) {
      await groups.create({ name: groupName, hidden: 0, private: 0, disableJoinRequests: 1 });
    }
    await groups.join(groupName, uid);
  } catch (e) {
    winston.warn('[rules-quiz] addUserToSuccessGroup failed: ' + e.message);
  }
}

module.exports = {
  notifyUserPassed,
  notifyAdminsRepeatedFails,
  addUserToSuccessGroup,
};
