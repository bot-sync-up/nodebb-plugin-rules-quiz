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

	// ONLY match the exact gate codes we embed in the server error message.
	// Earlier versions also matched Hebrew fragments like "לפני הפרסום"
	// which collide with common NodeBB UI strings (composer preview banner,
	// validation toasts, etc.) and caused the gate-redirect to fire
	// spuriously on unrelated pages. Code-only matching is unambiguous.
	var POST_CODE = 'rules-quiz:post-gate';
	var TOPIC_CODE = 'rules-quiz:topic-gate';

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
		// Only consume / redirect when our exact code marker is present.
		// We mark the node as seen ONLY when we actually match, so other
		// benign alerts aren't accidentally tagged.
		if (text.indexOf(POST_CODE) !== -1) {
			el.dataset.rqSeen = '1';
			return redirect('post');
		}
		if (text.indexOf(TOPIC_CODE) !== -1) {
			el.dataset.rqSeen = '1';
			return redirect('topic');
		}
	}

	function scan(root) {
		// Narrower selector list: only the actual NodeBB alert / toast
		// containers. [role="alert"] is too generic (NodeBB uses it on
		// composer previews, form-validation banners, nav hints, etc.) and
		// previously caused gate-redirect to fire on unrelated UI.
		var nodes = (root || document).querySelectorAll(
			'.alert-danger, .alert-error, .toast-error, .alert.alert-danger, [data-alert-type="error"]'
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
									'.alert-danger, .alert-error, .toast-error, .alert.alert-danger, [data-alert-type="error"]'
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
