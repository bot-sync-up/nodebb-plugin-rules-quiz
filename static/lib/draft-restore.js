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

	var STALE_MS = 5 * 60 * 1000; // 5 minutes — drafts older than this expire

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
		// Quill rich-text composer (nodebb-plugin-composer-quill) uses a
		// contenteditable div, not a textarea.
		var quillEl = composer.querySelector('.ql-editor');
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
		} else if (!bodyEl && quillEl && draft.body) {
			var existing = (quillEl.textContent || '').trim();
			if (!existing) {
				// Insert as a paragraph so Quill picks it up. Use textContent
				// to avoid injecting HTML (XSS-safe).
				var p = document.createElement('p');
				p.textContent = draft.body;
				quillEl.innerHTML = '';
				quillEl.appendChild(p);
				quillEl.dispatchEvent(new Event('input', { bubbles: true }));
				changed = true;
			}
		}
		return changed;
	}

	function tryRestore(composer) {
		if (!composer || composer.__rqDraftSeen) return;
		var found = readDraftFor(composer);
		if (!found) return;
		// Mark and CLEAN the localStorage key right away. The key has
		// been "claimed" by this composer instance; if applyDraft below
		// ends up not changing anything (because NodeBB's own draft
		// restore got there first and populated the inputs), we still
		// don't want a stale key sitting around to mis-restore into a
		// later composer. Single-use semantics.
		composer.__rqDraftSeen = true;
		try { localStorage.removeItem(found.key); } catch (_) { /* noop */ }
		// The composer might be opening but its inputs haven't materialised
		// yet. Apply repeatedly until something sticks or we give up.
		var attempts = 0;
		var iv = setInterval(function () {
			attempts++;
			var changed = applyDraft(composer, found.draft);
			if (changed || attempts > 8) clearInterval(iv);
		}, 250);
	}

	// Sweep stale rqDraft:* keys on page load. A draft older than 5 min
	// is almost certainly leftover from a prior session.
	function sweepStaleDrafts() {
		try {
			var now = Date.now();
			var toRemove = [];
			for (var i = 0; i < localStorage.length; i++) {
				var k = localStorage.key(i);
				if (!k || k.indexOf('rqDraft:') !== 0) continue;
				try {
					var v = JSON.parse(localStorage.getItem(k) || '{}');
					if (!v.at || (now - v.at) > 5 * 60 * 1000) toRemove.push(k);
				} catch (_) { toRemove.push(k); }
			}
			for (var j = 0; j < toRemove.length; j++) {
				localStorage.removeItem(toRemove[j]);
			}
		} catch (_) { /* noop */ }
	}

	// Programmatically open the composer if we just came back from a quiz
	// pass (gate-redirect set sessionStorage.rqAutoOpenComposer = 'post' |
	// 'topic'). For 'topic', click the New-Topic button on the category
	// page; for 'post', click a Reply button on the topic page.
	function autoOpenIfRequested() {
		var mode = '';
		try { mode = sessionStorage.getItem('rqAutoOpenComposer') || ''; } catch (_) { /* noop */ }
		if (!mode) return;
		try { sessionStorage.removeItem('rqAutoOpenComposer'); } catch (_) { /* noop */ }
		var clicker = function () {
			var btn = null;
			if (mode === 'topic') {
				btn = document.querySelector('[component="category/post"]')
					|| document.querySelector('[data-action="newtopic"]')
					|| document.querySelector('.btn-new-topic');
			} else {
				btn = document.querySelector('[component="topic/reply"]')
					|| document.querySelector('[component="post/reply"]')
					|| document.querySelector('[data-action="reply"]');
			}
			if (btn) {
				btn.click();
				return true;
			}
			return false;
		};
		// The button may not be in the DOM yet on slow page loads.
		// Try a few times with a short delay.
		var attempts = 0;
		var iv = setInterval(function () {
			attempts++;
			if (clicker() || attempts > 12) clearInterval(iv);
		}, 250);
	}

	function init() {
		// Sweep any stale drafts (>5min old) from previous sessions before
		// we start matching against the current page.
		sweepStaleDrafts();
		// Catch composers already in the DOM at page load.
		document.querySelectorAll('[component="composer"], .composer').forEach(tryRestore);
		// Also try to re-open the composer if we were redirected here
		// from a passing quiz.
		autoOpenIfRequested();
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
