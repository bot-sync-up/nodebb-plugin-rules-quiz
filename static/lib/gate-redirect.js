'use strict';

/* global MutationObserver */

/**
 * gate-redirect.js (v0.7.0)
 *
 * Strategy: instead of trying to match server error toasts (which is
 * fragile — translation + markup change between NodeBB versions and
 * themes), we intercept the actual SUBMIT button clicks inside the
 * composer. Right after the user clicks Submit we ask the server for
 * the current gate status and, if a gate is active and the user has no
 * token, redirect them to the matching mini-quiz.
 *
 * The eager check fires only on submit-button clicks, never on Reply
 * or New-Topic buttons that just open the composer — so the user can
 * browse the forum freely. The actual submit may still go through if
 * it races us; that's fine, the server will reject and we'll catch the
 * follow-up alert via DOM scan as a backup.
 */

(function () {
	if (typeof window === 'undefined' || typeof document === 'undefined') return;
	if (window.__rqGateRedirectV7) return;
	window.__rqGateRedirectV7 = true;

	var STATUS_URL = '/api/v3/plugins/rules-quiz/gate-status';
	var POST_CODE = 'rules-quiz:post-gate';
	var TOPIC_CODE = 'rules-quiz:topic-gate';

	function currentReturnTo() {
		return window.location.pathname + (window.location.search || '');
	}

	function redirect(mode) {
		var returnTo = currentReturnTo();
		try { sessionStorage.setItem('rqReturnTo', returnTo); } catch (_) { /* noop */ }
		window.location.href = '/quiz?mode=' + encodeURIComponent(mode)
			+ '&returnTo=' + encodeURIComponent(returnTo);
	}

	function fetchStatus() {
		return fetch(STATUS_URL, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
			.then(function (r) { return r.json(); })
			.then(function (j) { return (j && j.response !== undefined) ? j.response : j; })
			.catch(function () { return null; });
	}

	// Decide if this submit is a NEW TOPIC or a REPLY based on the composer
	// header / hidden inputs. NodeBB composer-default puts a hidden field
	// `data-action="post"` with a tid (= reply) or cid (= new topic).
	function detectKind(submitEl) {
		var composer = submitEl.closest('[component="composer"]')
			|| submitEl.closest('.composer')
			|| submitEl.closest('[data-cid],[data-tid]')
			|| document.querySelector('[component="composer"]');
		if (!composer) return 'post'; // safe default
		// Topic creation has cid + title input, no tid.
		if (composer.dataset && composer.dataset.tid) return 'post';
		if (composer.dataset && composer.dataset.cid && !composer.dataset.tid) return 'topic';
		// Fallback: look for a topic title input visible in the composer
		var titleInput = composer.querySelector('input[name="title"]');
		if (titleInput && titleInput.offsetParent !== null) return 'topic';
		return 'post';
	}

	// Submit-button selectors — VERY specific so we never catch nav links.
	var SUBMIT_SELECTORS = [
		'[component="composer/submit"]',
		'.composer-submit',
		'[data-action="post"]',
	];

	function matchesAny(el, selectors) {
		if (!el || !el.closest) return null;
		for (var i = 0; i < selectors.length; i++) {
			var m = el.closest(selectors[i]);
			if (m) return m;
		}
		return null;
	}

	function onSubmitClick(e) {
		var btn = matchesAny(e.target, SUBMIT_SELECTORS);
		if (!btn) return;
		// Eagerly check gate-status. If it shows we're blocked, preventDefault
		// and redirect. We CANNOT block the click synchronously while we wait
		// (fetch is async), so we let the click proceed AND queue a backup
		// check 800ms later — if the gate response came back with a block,
		// redirect even if NodeBB already errored out.
		var kind = detectKind(btn);
		setTimeout(function () {
			fetchStatus().then(function (status) {
				if (!status || !status.loggedIn) return;
				if (kind === 'topic') {
					if (status.topicGate && status.topicGate.active && !status.topicGate.hasToken) {
						redirect('topic');
					}
				} else {
					if (status.postGate && status.postGate.active && !status.postGate.hasToken) {
						redirect('post');
					}
				}
			});
		}, 800);
	}

	document.addEventListener('click', onSubmitClick, true); // capture phase

	// Backup: also scan for our exact code markers in alert toasts. Useful
	// if NodeBB shows the error in a non-standard container.
	function inspectAlert(el) {
		if (!el || el.dataset.rqSeen === '1') return;
		var text = String(el.textContent || '');
		if (!text) return;
		if (text.indexOf(POST_CODE) !== -1) {
			el.dataset.rqSeen = '1';
			return redirect('post');
		}
		if (text.indexOf(TOPIC_CODE) !== -1) {
			el.dataset.rqSeen = '1';
			return redirect('topic');
		}
	}

	function scanAlerts(root) {
		var nodes = (root || document).querySelectorAll(
			'.alert-danger, .alert-error, .toast-error, [data-alert-type="error"]'
		);
		for (var i = 0; i < nodes.length; i++) inspectAlert(nodes[i]);
	}

	function wireBackup() {
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
