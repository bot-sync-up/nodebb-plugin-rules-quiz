'use strict';

/* global MutationObserver */

/**
 * gate-redirect.js
 *
 * Runs on every forum page. When the server rejects a reply or a new topic
 * with one of our gate codes (`rules-quiz:post-gate` / `:topic-gate`), the
 * NodeBB composer surfaces the error via an alert toast. We detect that
 * alert and auto-navigate to the right mini-quiz at `/quiz?mode=…&returnTo=…`.
 *
 * After passing, the quiz page itself bounces the user back to `returnTo`.
 * This module is self-initialising — no `define()` wrapper, no init() call
 * needed — it runs at script load time.
 */

(function () {
	if (typeof window === 'undefined' || typeof document === 'undefined') return;
	if (window.__rqGateRedirectWired) return;
	window.__rqGateRedirectWired = true;

	// Server error codes + human-readable fragments that appear in the
	// translated toast. Either path triggers the redirect.
	var POST_CODE = 'rules-quiz:post-gate';
	var TOPIC_CODE = 'rules-quiz:topic-gate';
	var POST_MSG_HINTS = ['לפני הפרסום', 'need_post_quiz', 'pass.*post quiz'];
	var TOPIC_MSG_HINTS = ['לפני פתיחת נושא', 'need_topic_quiz', 'pass.*topic quiz'];

	function includesAny(hay, needles) {
		for (var i = 0; i < needles.length; i++) {
			if (hay.indexOf(needles[i]) !== -1) return true;
		}
		return false;
	}

	function redirect(mode) {
		var returnTo = window.location.pathname + (window.location.search || '');
		try { sessionStorage.setItem('rqReturnTo', returnTo); } catch (_) { /* noop */ }
		var url = '/quiz?mode=' + encodeURIComponent(mode)
			+ '&returnTo=' + encodeURIComponent(returnTo);
		window.location.href = url;
	}

	function inspect(el) {
		if (!el || el.dataset.rqSeen === '1') return;
		var text = String(el.textContent || '');
		if (!text) return;
		el.dataset.rqSeen = '1';
		if (text.indexOf(POST_CODE) !== -1 || includesAny(text, POST_MSG_HINTS)) {
			return redirect('post');
		}
		if (text.indexOf(TOPIC_CODE) !== -1 || includesAny(text, TOPIC_MSG_HINTS)) {
			return redirect('topic');
		}
	}

	function scan(root) {
		var nodes = (root || document).querySelectorAll(
			'.alert-danger, .alert-error, .toast-error, [data-alert-type="error"], [role="alert"]'
		);
		for (var i = 0; i < nodes.length; i++) inspect(nodes[i]);
	}

	function wire() {
		scan();
		if (window.MutationObserver && document.body) {
			var obs = new MutationObserver(function (muts) {
				for (var i = 0; i < muts.length; i++) {
					var m = muts[i];
					if (m.addedNodes) {
						for (var j = 0; j < m.addedNodes.length; j++) {
							var n = m.addedNodes[j];
							if (n.nodeType !== 1) continue;
							inspect(n);
							if (n.querySelectorAll) {
								var kids = n.querySelectorAll(
									'.alert-danger, .alert-error, .toast-error, [data-alert-type="error"], [role="alert"]'
								);
								for (var k = 0; k < kids.length; k++) inspect(kids[k]);
							}
						}
					}
				}
			});
			obs.observe(document.body, { childList: true, subtree: true });
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', wire);
	} else {
		wire();
	}
})();
