'use strict';

/**
 * Load the user fields the gate decisions need: groups (for exemption),
 * reputation, joindate, and NodeBB's own post/topic counts.
 *
 * Each lookup can fail on its own (DB blip, NodeBB API change). We try them
 * separately and always check isAdministrator / isGlobalModerator directly,
 * so a failed group lookup can't make staff lose their exemption and get
 * blocked by their own gate.
 *
 * @param {number|string} uid
 * @returns {Promise<object>}
 */
async function getMinimalUser(uid) {
  const user = (() => { try { return require.main.require('./src/user'); } catch (e) { return null; } })();
  const groups = (() => { try { return require.main.require('./src/groups'); } catch (e) { return null; } })();
  let data = {};
  const groupNames = [];
  if (user) {
    try {
      data = await user.getUserFields(uid, ['uid', 'username', 'reputation', 'joindate', 'postcount', 'topiccount']) || {};
    } catch (_) { /* keep {} */ }
    try {
      if (await user.isAdministrator(uid)) groupNames.push('administrators');
    } catch (_) { /* noop */ }
    try {
      if (typeof user.isGlobalModerator === 'function' && await user.isGlobalModerator(uid)) {
        groupNames.push('Global Moderators');
      }
    } catch (_) { /* noop */ }
  }
  if (groups) {
    try {
      const arr = await groups.getUserGroups([uid]);
      const list = (arr && arr[0]) || [];
      list.forEach((g) => { if (g && g.name && groupNames.indexOf(g.name) === -1) groupNames.push(g.name); });
    } catch (_) { /* keep what we have */ }
  }
  return Object.assign({}, data, { uid: uid, groups: groupNames });
}

module.exports = { getMinimalUser };
