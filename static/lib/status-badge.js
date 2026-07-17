'use strict';

/**
 * status-badge.js
 *
 * Shows a small floating badge in the corner of every page reporting the
 * user's current rules-quiz state — onboarding pass, posts gate counter,
 * topics gate counter, and active tokens. Lets the user see at a glance
 * that data IS being saved and which gate they're currently in.
 *
 * Click the badge to refresh; click the × to hide for the session.
 */

(function () {
	if (typeof window === 'undefined' || typeof document === 'undefined') return;
	if (window.__rqStatusBadgeWired) return;
	window.__rqStatusBadgeWired = true;

	var STATUS_URL = '/api/v3/plugins/rules-quiz/gate-status';

	function injectStyles() {
		if (document.getElementById('rq-status-badge-styles')) return;
		var s = document.createElement('style');
		s.id = 'rq-status-badge-styles';
		s.textContent = ''
			+ '#rq-status-badge{position:fixed;bottom:14px;inset-inline-end:14px;z-index:99998;background:rgba(15,23,42,.92);color:#e2e8f0;font-family:inherit;font-size:.82em;line-height:1.4;padding:.55rem .75rem .5rem;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.18);max-width:260px;backdrop-filter:blur(6px);direction:rtl;cursor:default;user-select:none;transition:opacity .2s ease}'
			+ '#rq-status-badge[hidden]{display:none}'
			+ '#rq-status-badge .rq-sb-row{display:flex;justify-content:space-between;gap:.5rem;align-items:center;padding:.1rem 0}'
			+ '#rq-status-badge .rq-sb-label{color:#94a3b8;font-weight:500}'
			+ '#rq-status-badge .rq-sb-value{font-weight:700}'
			+ '#rq-status-badge .rq-sb-pass{color:#86efac}'
			+ '#rq-status-badge .rq-sb-warn{color:#fde68a}'
			+ '#rq-status-badge .rq-sb-bad{color:#fca5a5}'
			+ '#rq-status-badge .rq-sb-head{display:flex;justify-content:space-between;align-items:center;gap:.5rem;margin-bottom:.25rem;padding-bottom:.25rem;border-bottom:1px solid rgba(255,255,255,.1)}'
			+ '#rq-status-badge .rq-sb-title{font-weight:700;color:#fff;font-size:.95em}'
			+ '#rq-status-badge .rq-sb-close{background:transparent;border:0;color:#94a3b8;cursor:pointer;font-size:1.1em;line-height:1;padding:0 .25rem;border-radius:4px}'
			+ '#rq-status-badge .rq-sb-close:hover{color:#fff;background:rgba(255,255,255,.08)}'
			+ '#rq-status-badge .rq-sb-refresh{background:transparent;border:0;color:#94a3b8;cursor:pointer;font-size:.85em;padding:0 .25rem;border-radius:4px}'
			+ '#rq-status-badge .rq-sb-refresh:hover{color:#fff;background:rgba(255,255,255,.08)}'
			+ '#rq-status-badge.rq-sb-collapsed .rq-sb-body{display:none}'
			+ '#rq-status-badge .rq-sb-toggle{cursor:pointer}'
			+ '@media (max-width:600px){#rq-status-badge{font-size:.78em;max-width:200px}}';
		document.head.appendChild(s);
	}

	function buildEl() {
		var el = document.createElement('div');
		el.id = 'rq-status-badge';
		el.innerHTML = ''
			+ '<div class="rq-sb-head">'
			+   '<span class="rq-sb-title rq-sb-toggle">📊 מצב שאלון</span>'
			+   '<span>'
			+     '<button type="button" class="rq-sb-refresh" title="רענן">⟳</button>'
			+     '<button type="button" class="rq-sb-close" title="סגור">×</button>'
			+   '</span>'
			+ '</div>'
			+ '<div class="rq-sb-body">'
			+   '<div class="rq-sb-row"><span class="rq-sb-label">הרשמה</span><span class="rq-sb-value" data-rq-onboarding>—</span></div>'
			+   '<div class="rq-sb-row"><span class="rq-sb-label">פוסטים</span><span class="rq-sb-value" data-rq-posts>—</span></div>'
			+   '<div class="rq-sb-row"><span class="rq-sb-label">נושאים</span><span class="rq-sb-value" data-rq-topics>—</span></div>'
			+   '<div class="rq-sb-row"><span class="rq-sb-label">טוקן פוסט</span><span class="rq-sb-value" data-rq-post-token>—</span></div>'
			+   '<div class="rq-sb-row"><span class="rq-sb-label">טוקן נושא</span><span class="rq-sb-value" data-rq-topic-token>—</span></div>'
			+ '</div>';
		return el;
	}

	function setText(el, sel, text, cls) {
		var node = el.querySelector(sel);
		if (!node) return;
		node.textContent = text;
		node.classList.remove('rq-sb-pass', 'rq-sb-warn', 'rq-sb-bad');
		if (cls) node.classList.add(cls);
	}

	function render(el, status) {
		if (!status || !status.loggedIn) {
			el.hidden = true;
			return;
		}
		// Onboarding
		if (status.onboardingExempt) {
			setText(el, '[data-rq-onboarding]', 'פטור', 'rq-sb-pass');
		} else if (status.onboardingPassed) {
			setText(el, '[data-rq-onboarding]', '✓ עבר', 'rq-sb-pass');
		} else {
			setText(el, '[data-rq-onboarding]', 'ממתין', 'rq-sb-warn');
		}
		// Posts
		var pg = status.postGate || {};
		if (pg.limit > 0) {
			setText(el, '[data-rq-posts]', '⁨' + pg.postsCreated + ' / ' + pg.limit + '⁩',
				pg.postsCreated >= pg.limit ? 'rq-sb-pass' : '');
		} else {
			setText(el, '[data-rq-posts]', 'ללא הגבלה', 'rq-sb-pass');
		}
		// Topics
		var tg = status.topicGate || {};
		if (tg.limit > 0) {
			setText(el, '[data-rq-topics]', '⁨' + tg.topicsCreated + ' / ' + tg.limit + '⁩',
				tg.topicsCreated >= tg.limit ? 'rq-sb-pass' : '');
		} else {
			setText(el, '[data-rq-topics]', 'ללא הגבלה', 'rq-sb-pass');
		}
		// Tokens
		setText(el, '[data-rq-post-token]', pg.hasToken ? '✓ זמין' : '— אין',
			pg.hasToken ? 'rq-sb-pass' : 'rq-sb-bad');
		setText(el, '[data-rq-topic-token]', tg.hasToken ? '✓ זמין' : '— אין',
			tg.hasToken ? 'rq-sb-pass' : 'rq-sb-bad');
	}

	function fetchAndRender(el) {
		fetch(STATUS_URL, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
			.then(function (r) { return r.json(); })
			.then(function (j) {
				var data = (j && j.response !== undefined) ? j.response : j;
				render(el, data);
			})
			.catch(function () { /* silent */ });
	}

	function mount() {
		// Don't show on the quiz page itself or the ACP.
		var p = window.location.pathname || '';
		if (p === '/quiz' || p.indexOf('/admin') === 0) return;
		// Don't re-show if user closed it this session.
		try { if (sessionStorage.getItem('rqBadgeHidden') === '1') return; } catch (_) { /* noop */ }
		injectStyles();
		var el = buildEl();
		document.body.appendChild(el);
		fetchAndRender(el);
		// Refresh every 30s so the user sees state changes after a post —
		// but skip the poll while the tab is hidden to avoid hammering
		// /gate-status on backgrounded tabs. Refresh once on re-focus.
		var iv = setInterval(function () {
			if (document.hidden) return;
			fetchAndRender(el);
		}, 30000);
		document.addEventListener('visibilitychange', function () {
			if (!document.hidden && !el.hidden) fetchAndRender(el);
		});
		el.addEventListener('click', function (e) {
			var t = e.target;
			if (t.classList && t.classList.contains('rq-sb-close')) {
				el.hidden = true;
				try { sessionStorage.setItem('rqBadgeHidden', '1'); } catch (_) { /* noop */ }
				clearInterval(iv);
			} else if (t.classList && t.classList.contains('rq-sb-refresh')) {
				fetchAndRender(el);
			} else if (t.classList && t.classList.contains('rq-sb-toggle')) {
				el.classList.toggle('rq-sb-collapsed');
			}
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', mount);
	} else {
		mount();
	}
})();
