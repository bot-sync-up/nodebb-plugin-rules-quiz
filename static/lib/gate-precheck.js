'use strict';

/**
 * gate-precheck.js
 *
 * Runs on every page. Intercepts clicks on "Reply" and "New topic"
 * buttons BEFORE NodeBB opens the composer. If the user needs to pass
 * a mini-quiz first, redirects them to /quiz?mode=… right away — they
 * never see the composer, so no typed text can be lost when the server
 * gates them on submit.
 *
 * This pairs with gate-redirect.js (which catches the error path when
 * we miss a button click for any reason) — together they make the gate
 * effectively unavoidable without any way to waste typing.
 */

(function () {
	if (typeof window === 'undefined' || typeof document === 'undefined') return;
	if (window.__rqGatePrecheckWired) return;
	window.__rqGatePrecheckWired = true;

	var STATUS_URL = '/api/v3/plugins/rules-quiz/gate-status';
	var CACHE_MS = 10 * 1000;
	var cache = null;
	var cacheExp = 0;
	var inflight = null;

	function fetchStatus() {
		var now = Date.now();
		if (cache && now < cacheExp) return Promise.resolve(cache);
		if (inflight) return inflight;
		inflight = fetch(STATUS_URL, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
			.then(function (r) { return r.json(); })
			.then(function (j) {
				var data = (j && j.response !== undefined) ? j.response : j;
				cache = data || null;
				cacheExp = Date.now() + CACHE_MS;
				inflight = null;
				return cache;
			})
			.catch(function () { inflight = null; return null; });
		return inflight;
	}

	function invalidateCache() { cache = null; cacheExp = 0; }

	function currentReturnTo() {
		return window.location.pathname + (window.location.search || '');
	}

	function redirectToQuiz(mode) {
		var returnTo = currentReturnTo();
		try { sessionStorage.setItem('rqReturnTo', returnTo); } catch (_) { /* noop */ }
		window.location.href = '/quiz?mode=' + encodeURIComponent(mode)
			+ '&returnTo=' + encodeURIComponent(returnTo);
	}

	// Selectors for reply / new-topic buttons across NodeBB themes.
	var REPLY_SELECTORS = [
		'[component="topic/reply"]',
		'[component="post/reply"]',
		'[component="post/quote"]',
		'[data-action="reply"]',
		'.post-tools [data-component="post/reply"]',
		'.btn-reply',
	];
	var TOPIC_SELECTORS = [
		'[component="category/post"]',
		'[data-action="newtopic"]',
		'.new-topic',
		'.btn-new-topic',
		'a[href$="/compose"]',
	];

	function matchesAny(el, selectors) {
		if (!el || !el.closest) return null;
		for (var i = 0; i < selectors.length; i++) {
			var m = el.closest(selectors[i]);
			if (m) return m;
		}
		return null;
	}

	function handleClick(e) {
		// Skip modifier keys (open in new tab etc.) — let them through.
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		var replyBtn = matchesAny(e.target, REPLY_SELECTORS);
		var topicBtn = replyBtn ? null : matchesAny(e.target, TOPIC_SELECTORS);
		if (!replyBtn && !topicBtn) return;
		var kind = replyBtn ? 'post' : 'topic';

		// We need to make a synchronous decision, but the status fetch is async.
		// Strategy: if we have a cached status, act on it immediately; otherwise
		// preventDefault, fetch, and either let through or redirect.
		var now = Date.now();
		if (cache && now < cacheExp) {
			gateDecision(cache, kind, e);
			return;
		}
		// No cache: block the click, fetch, then replay or redirect.
		e.preventDefault();
		e.stopPropagation();
		fetchStatus().then(function (status) {
			if (!status) return; // fetch failed — let user retry
			gateDecision(status, kind, e, true);
		});
	}

	function gateDecision(status, kind, e, fetchedAsync) {
		if (!status || !status.loggedIn) return;
		// Onboarding still pending — core gate handles that.
		if (!status.onboardingPassed && !status.onboardingExempt) return;
		var gate = kind === 'topic' ? status.topicGate : status.postGate;
		if (!gate || !gate.active) return;
		if (gate.hasToken) return; // good to go — let NodeBB open the composer
		// No token — bounce to the mini-quiz.
		e.preventDefault();
		e.stopPropagation();
		redirectToQuiz(kind);
	}

	document.addEventListener('click', handleClick, true); // capture phase

	// Invalidate the cache whenever the user navigates (ajaxify or full).
	if (window.$) {
		try { window.$(window).on('action:ajaxify.end', invalidateCache); } catch (_) { /* noop */ }
	}
	window.addEventListener('focus', invalidateCache);
})();
