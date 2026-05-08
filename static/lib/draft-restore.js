'use strict';

/**
 * draft-restore.js (v0.7.4)
 *
 * Pairs with gate-redirect.js: when the user is bounced to a mini-quiz,
 * gate-redirect saves the composer's title + body to localStorage under
 * a key like `rqDraft:topic:<cid>` or `rqDraft:reply:<tid>`. This script
 * watches for the composer to open after the user returns from the quiz
 * and re-populates the title + body so the user doesn't have to retype.
 *
 * The localStorage entry is consumed (cleared) once it's been applied so
 * we don't keep re-applying it on every composer-open.
 */

(function () {
	if (typeof window === 'undefined' || typeof document === 'undefined') return;
	if (window.__rqDraftRestoreV7) return;
	window.__rqDraftRestoreV7 = true;

	var STALE_MS = 30 * 60 * 1000; // 30 minutes — drafts older than this expire

	function readDraftFor(composer) {
		var ds = composer.dataset || {};
		var tid = ds.tid;
		var cid = ds.cid;
		var keys = [];
		if (tid && tid !== '0') keys.push('rqDraft:reply:' + tid);
		if (cid) keys.push('rqDraft:topic:' + cid);
		// Also try a broad fallback when neither is on the dataset.
		if (!keys.length) {
			try {
				for (var i = 0; i < localStorage.length; i++) {
					var k = localStorage.key(i);
					if (k && k.indexOf('rqDraft:') === 0) keys.push(k);
				}
			} catch (_) { /* noop */ }
		}
		for (var j = 0; j < keys.length; j++) {
			try {
				var raw = localStorage.getItem(keys[j]);
				if (!raw) continue;
				var draft = JSON.parse(raw);
				if (!draft || typeof draft !== 'object') continue;
				if (draft.at && (Date.now() - draft.at) > STALE_MS) {
					localStorage.removeItem(keys[j]);
					continue;
				}
				return { key: keys[j], draft: draft };
			} catch (_) { /* corrupt, skip */ }
		}
		return null;
	}

	function applyDraft(composer, draft) {
		var titleEl = composer.querySelector('input[name="title"]')
			|| composer.querySelector('input.title')
			|| composer.querySelector('[component="composer/title"]');
		var bodyEl = composer.querySelector('textarea[component="composer/textarea"]')
			|| composer.querySelector('textarea.write')
			|| composer.querySelector('textarea[name="content"]')
			|| composer.querySelector('textarea');
		var changed = false;
		if (titleEl && draft.title && !titleEl.value) {
			titleEl.value = draft.title;
			titleEl.dispatchEvent(new Event('input', { bubbles: true }));
			titleEl.dispatchEvent(new Event('change', { bubbles: true }));
			changed = true;
		}
		if (bodyEl && draft.body && !bodyEl.value) {
			bodyEl.value = draft.body;
			bodyEl.dispatchEvent(new Event('input', { bubbles: true }));
			bodyEl.dispatchEvent(new Event('change', { bubbles: true }));
			changed = true;
		}
		return changed;
	}

	function tryRestore(composer) {
		if (!composer || composer.__rqDraftSeen) return;
		var found = readDraftFor(composer);
		if (!found) return;
		// The composer might be opening but its inputs haven't materialised
		// yet. Try a few times with a short delay before giving up.
		var attempts = 0;
		var iv = setInterval(function () {
			attempts++;
			var changed = applyDraft(composer, found.draft);
			if (changed || attempts > 8) {
				clearInterval(iv);
				if (changed) {
					try { localStorage.removeItem(found.key); } catch (_) { /* noop */ }
					composer.__rqDraftSeen = true;
				}
			}
		}, 250);
	}

	function init() {
		// Catch composers already in the DOM at page load.
		document.querySelectorAll('[component="composer"], .composer').forEach(tryRestore);
		// Catch composers added later via ajaxify / composer-default.
		if (window.MutationObserver && document.body) {
			var obs = new MutationObserver(function (muts) {
				for (var i = 0; i < muts.length; i++) {
					var m = muts[i];
					if (!m.addedNodes) continue;
					for (var j = 0; j < m.addedNodes.length; j++) {
						var n = m.addedNodes[j];
						if (n.nodeType !== 1) continue;
						if (n.matches && (n.matches('[component="composer"]') || n.matches('.composer'))) {
							tryRestore(n);
						}
						if (n.querySelectorAll) {
							var inner = n.querySelectorAll('[component="composer"], .composer');
							for (var k = 0; k < inner.length; k++) tryRestore(inner[k]);
						}
					}
				}
			});
			obs.observe(document.body, { childList: true, subtree: true });
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
