'use strict';

/* global MutationObserver */

/**
 * gate-redirect.js
 *
 * When the server rejects a reply or new topic because of a quiz gate, send
 * the user to the matching quiz (saving their draft first). The rejection
 * is recognised by a marker the server puts in the error text
 * ([rules-quiz:post-gate], [rules-quiz:topic-gate], [rules-quiz:not-passed]),
 * read from the composer's error hook and, as a backup, from error toasts.
 */

(function () {
	if (typeof window === 'undefined' || typeof document === 'undefined') return;
	if (window.__rqGateRedirectV7) return;
	window.__rqGateRedirectV7 = true;

	var POST_CODE = 'rules-quiz:post-gate';
	var TOPIC_CODE = 'rules-quiz:topic-gate';
	var ONBOARDING_CODE = 'rules-quiz:not-passed';

	function currentReturnTo() {
		return window.location.pathname + (window.location.search || '');
	}

	// Pull the composer's current title + body so we can stash them in
	// localStorage before navigating away; nodebb-plugin-composer-default's
	// own draft saver doesn't always cover NEW-topic state, leading to
	// users typing a title + body, getting bounced to the quiz, and coming
	// back to an empty composer.
	// Which topic (reply) or category (new topic) a composer posts to.
	// NodeBB 4 (Harmony) no longer puts data-tid / data-cid on the composer:
	// there, a composer with a title field opens a topic and one without
	// replies to the topic on screen.
	function composerTarget(composer) {
		var ds = composer.dataset || {};
		var tid = parseInt(ds.tid, 10) > 0 ? String(ds.tid) : '';
		var cid = ds.cid ? String(ds.cid) : '';
		if (!tid && !cid) {
			var hasTitle = !!composer.querySelector('input[name="title"], input.title, [component="composer/title"]');
			var page = (window.ajaxify && window.ajaxify.data) || {};
			if (hasTitle) cid = page.cid ? String(page.cid) : '';
			else if (page.tid) tid = String(page.tid);
		}
		return { tid: tid, cid: cid };
	}

	function captureComposerDraft() {
		var composer = document.querySelector('[component="composer"], .composer');
		if (!composer) return null;
		// Title — try a few common selectors NodeBB themes use.
		var titleEl = composer.querySelector('input[name="title"]')
			|| composer.querySelector('input.title')
			|| composer.querySelector('[component="composer/title"]');
		// Body — likewise.
		var bodyEl = composer.querySelector('textarea[component="composer/textarea"]')
			|| composer.querySelector('textarea.write')
			|| composer.querySelector('textarea[name="content"]')
			|| composer.querySelector('textarea');
		// Quill rich-text composer stores body in a contenteditable div.
		var quillEl = composer.querySelector('.ql-editor');
		var body = (bodyEl && bodyEl.value) || (quillEl ? (quillEl.textContent || '').trim() : '');
		var target = composerTarget(composer);
		var draft = {
			title: (titleEl && titleEl.value) || '',
			body: body,
			cid: target.cid,
			tid: target.tid,
			at: Date.now(),
		};
		if (!draft.title && !draft.body) return null;
		return draft;
	}

	function saveDraft(draft) {
		if (!draft) return;
		try {
			var key = draft.tid ? ('rqDraft:reply:' + draft.tid) : ('rqDraft:topic:' + (draft.cid || 'X'));
			localStorage.setItem(key, JSON.stringify(draft));
		} catch (_) { /* noop */ }
	}

	// A composer posting a new topic, or replying. Harmony (NodeBB 4) puts
	// no tid/cid on the composer; there a title field means a new topic.
	function composerKind(composer) {
		if (!composer) return 'post';
		var target = composerTarget(composer);
		if (target.tid) return 'post';
		if (target.cid) return 'topic';
		return composer.querySelector('input[name="title"], input.title, [component="composer/title"]') ? 'topic' : 'post';
	}

	var redirecting = false;

	function redirect(mode) {
		if (redirecting) return;
		redirecting = true;
		var returnTo = currentReturnTo();
		try { sessionStorage.setItem('rqReturnTo', returnTo); } catch (_) { /* noop */ }
		// Save whatever the user has typed BEFORE we navigate away.
		saveDraft(captureComposerDraft());
		// Hint draft-restore.js to auto-reopen the composer after the user
		// passes the quiz and lands back here. The 'onboarding' redirect
		// carries no ?mode so the quiz page runs the full rules -> intro ->
		// questions flow; the composer to re-open is the one that failed.
		var openKind = mode === 'onboarding'
			? composerKind(document.querySelector('[component="composer"], .composer'))
			: (mode === 'topic' ? 'topic' : 'post');
		try { sessionStorage.setItem('rqAutoOpenComposer', openKind); } catch (_) { /* noop */ }
		var url = (mode === 'onboarding')
			? '/quiz?returnTo=' + encodeURIComponent(returnTo)
			: '/quiz?mode=' + encodeURIComponent(mode) + '&returnTo=' + encodeURIComponent(returnTo);
		window.location.href = url;
	}

	// The server rejects a gated write with an error whose text carries one
	// of these markers (library.js guardKind). Only an actual rejection
	// redirects: checking gate-status after a submit click could not tell a
	// rejected post from one that just went through and spent the token, and
	// sent users back to the quiz after every successful gated reply.
	function gateFromText(text) {
		text = String(text || '');
		if (text.indexOf(POST_CODE) !== -1) return 'post';
		if (text.indexOf(TOPIC_CODE) !== -1) return 'topic';
		if (text.indexOf(ONBOARDING_CODE) !== -1) return 'onboarding';
		return '';
	}

	// Primary: the composer's own error hook (nodebb-plugin-composer-default).
	function wireComposerHook() {
		var onHooks = function (hooks) {
			if (!hooks || typeof hooks.on !== 'function') return;
			hooks.on('filter:composer.error', function (data) {
				var gate = gateFromText(data && data.message);
				if (gate) redirect(gate);
				return data;
			});
		};
		try {
			if (window.app && typeof window.app.require === 'function') {
				window.app.require('hooks').then(onHooks, function () { /* older NodeBB */ });
			} else if (typeof window.require === 'function') {
				window.require(['hooks'], onHooks);
			}
		} catch (_) { /* the toast scan below still works */ }
	}

	// Backup: scan error toasts for the markers — covers NodeBB versions
	// without the composer hook, and errors shown outside the composer.
	function inspectAlert(el) {
		if (!el || el.dataset.rqSeen === '1') return;
		var gate = gateFromText(el.textContent);
		if (!gate) return;
		el.dataset.rqSeen = '1';
		redirect(gate);
	}

	function scanAlerts(root) {
		var nodes = (root || document).querySelectorAll(
			'.alert-danger, .alert-error, .toast-error, [data-alert-type="error"]'
		);
		for (var i = 0; i < nodes.length; i++) inspectAlert(nodes[i]);
	}

	function wireBackup() {
		wireComposerHook();
		scanAlerts();
		if (window.MutationObserver && document.body) {
			var obs = new MutationObserver(function (muts) {
				for (var i = 0; i < muts.length; i++) {
					var m = muts[i];
					if (m.addedNodes) {
						for (var j = 0; j < m.addedNodes.length; j++) {
							var n = m.addedNodes[j];
							if (n.nodeType !== 1) continue;
							inspectAlert(n);
							if (n.querySelectorAll) {
								var kids = n.querySelectorAll(
									'.alert-danger, .alert-error, .toast-error, [data-alert-type="error"]'
								);
								for (var k = 0; k < kids.length; k++) inspectAlert(kids[k]);
							}
						}
					}
				}
			});
			obs.observe(document.body, { childList: true, subtree: true });
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', wireBackup);
	} else {
		wireBackup();
	}
})();
