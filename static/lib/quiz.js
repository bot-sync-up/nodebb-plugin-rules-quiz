'use strict';

/* global define, app, config */

/**
 * Client controller for the user-facing quiz page.
 *
 * Owns the rules-ack -> intro -> question -> submit -> result flow on
 * `/quiz`. The server is the only source of truth for scoring; this
 * module merely collects answers and renders results returned by the
 * `/api/v3/plugins/rules-quiz/submit` endpoint.
 *
 * Bootstrap data (questions, settings, gateAck) is read from a
 * `<script type="application/json" id="rulesquiz-bootstrap">` block
 * embedded by `quiz/index.tpl`.
 */
define('forum/plugins/rules-quiz', [
	'translator',
	'alerts',
	'benchpress',
	'jquery',
], function (translator, alerts, Benchpress, $) {
	const API_BASE = '/api/v3/plugins/rules-quiz';

	const SCREEN_RULES = 'rulesquiz-rules';
	const SCREEN_INTRO = 'rulesquiz-intro';
	const SCREEN_QUIZ = 'rulesquiz-quiz';
	const SCREEN_RESULT = 'rulesquiz-result';

	let state = null;
	let timerHandle = null;
	let cooldownHandle = null;

	/**
	 * Read and parse the bootstrap JSON injected by the template.
	 *
	 * @returns {{questions: object[], settings: object, gateAck: boolean, rtl: boolean, lang: string}}
	 */
	function readBootstrap() {
		const node = document.getElementById('rulesquiz-bootstrap');
		if (!node) {
			return { questions: [], settings: {}, gateAck: false, rtl: false, lang: 'en-GB' };
		}
		try {
			return JSON.parse(node.textContent || node.innerText || '{}');
		} catch (e) {
			return { questions: [], settings: {}, gateAck: false, rtl: false, lang: 'en-GB' };
		}
	}

	/**
	 * Hide every `.rq-screen` then activate the requested one.
	 *
	 * @param {string} screenId One of the `SCREEN_*` constants.
	 */
	function showScreen(screenId) {
		const screens = document.querySelectorAll('#rulesquiz-app .rq-screen');
		for (let i = 0; i < screens.length; i++) {
			screens[i].classList.remove('active');
			screens[i].setAttribute('hidden', '');
			screens[i].style.display = 'none';
		}
		const target = document.getElementById(screenId);
		if (target) {
			target.classList.add('active');
			target.removeAttribute('hidden');
			target.style.display = 'block';
		}
	}

	/**
	 * Decide which screen to show on first load based on settings + gateAck.
	 */
	function decideInitialScreen() {
		const s = state.settings || {};
		const rules = s.rules || {};
		const intro = s.intro || {};
		if (rules.showRulesGate && !state.gateAck) {
			showScreen(SCREEN_RULES);
			return;
		}
		if (intro.show) {
			showScreen(SCREEN_INTRO);
			return;
		}
		startQuiz();
	}

	/**
	 * Render an arbitrary info state (empty / loading / error) inside the
	 * quiz screen container, hiding the prev/next/submit footer.
	 *
	 * @param {string} heading Already-translated heading text.
	 * @param {string} body Already-translated body text.
	 * @param {string} [extraHtml] Optional additional HTML (e.g. a retry button).
	 * @param {string} [className] Extra class on the wrapper div.
	 */
	function renderInfoState(heading, body, extraHtml, className) {
		const container = document.getElementById('rq-question');
		if (container) {
			container.innerHTML =
				'<div class="' + (className || 'rq-empty') + '">' +
					'<h2 class="rq-heading">' + esc(heading) + '</h2>' +
					'<p>' + esc(body) + '</p>' +
					(extraHtml || '') +
				'</div>';
		}
		const header = document.querySelector('#rulesquiz-quiz .rq-quiz-header');
		if (header) header.style.display = 'none';
		const prev = document.getElementById('rq-prev-btn');
		const next = document.getElementById('rq-next-btn');
		const submit = document.getElementById('rq-submit-btn');
		if (prev) prev.hidden = true;
		if (next) next.hidden = true;
		if (submit) submit.hidden = true;
	}

	/**
	 * Show the "no questions configured" friendly state.
	 */
	function showEmptyState() {
		const doRender = function (heading, body) {
			showScreen(SCREEN_QUIZ);
			renderInfoState(heading, body, '', 'rq-empty');
		};
		if (translator && typeof translator.translate === 'function') {
			translator.translate('[[rulesquiz:empty.heading]]', function (h) {
				translator.translate('[[rulesquiz:empty.body]]', function (b) {
					doRender(h, b);
				});
			});
		} else {
			doRender('No questions available yet', 'Administrators haven\'t set up any questions yet. Please try again later.');
		}
	}

	/**
	 * Show a transient "loading…" indicator inside the quiz screen.
	 */
	function showLoadingState() {
		const doRender = function (txt) {
			showScreen(SCREEN_QUIZ);
			const container = document.getElementById('rq-question');
			if (container) {
				container.innerHTML = '<div class="rq-loading">' + esc(txt) + '</div>';
			}
			const header = document.querySelector('#rulesquiz-quiz .rq-quiz-header');
			if (header) header.style.display = 'none';
			const prev = document.getElementById('rq-prev-btn');
			const next = document.getElementById('rq-next-btn');
			const submit = document.getElementById('rq-submit-btn');
			if (prev) prev.hidden = true;
			if (next) next.hidden = true;
			if (submit) submit.hidden = true;
		};
		if (translator && typeof translator.translate === 'function') {
			translator.translate('[[rulesquiz:loading]]', function (t) {
				doRender(t && t !== '[[rulesquiz:loading]]' ? t : 'טוען…');
			});
		} else {
			doRender('טוען…');
		}
	}

	/**
	 * Show an error state with a retry button.
	 *
	 * @param {Function} onRetry Called when the retry button is clicked.
	 */
	function showErrorState(onRetry) {
		const doRender = function (heading, body, retryLabel) {
			showScreen(SCREEN_QUIZ);
			const btnId = 'rq-error-retry-btn';
			renderInfoState(
				heading,
				body,
				'<button type="button" id="' + btnId + '" class="rq-btn rq-btn--primary" style="margin-top:1rem">' + esc(retryLabel) + '</button>',
				'rq-empty'
			);
			const btn = document.getElementById(btnId);
			if (btn && typeof onRetry === 'function') {
				btn.addEventListener('click', onRetry);
			}
		};
		if (translator && typeof translator.translate === 'function') {
			translator.translate('[[rulesquiz:error.heading]]', function (h) {
				translator.translate('[[rulesquiz:error.body]]', function (b) {
					translator.translate('[[rulesquiz:result.try_again]]', function (r) {
						doRender(
							h && h !== '[[rulesquiz:error.heading]]' ? h : 'שגיאה',
							b && b !== '[[rulesquiz:error.body]]' ? b : 'לא ניתן לטעון את החידון. נסו שוב.',
							r && r !== '[[rulesquiz:result.try_again]]' ? r : 'נסה שוב'
						);
					});
				});
			});
		} else {
			doRender('שגיאה', 'לא ניתן לטעון את החידון. נסו שוב.', 'נסה שוב');
		}
	}

	/**
	 * Fetch the quiz bootstrap data (questions + settings) from the API when
	 * the inline bootstrap block was missing or empty.
	 *
	 * @returns {Promise<{questions: object[], settings: object, gateAck: boolean}>}
	 */
	function fetchBootstrap() {
		const headers = { Accept: 'application/json' };
		return fetch(API_BASE + '/quiz', {
			method: 'GET',
			credentials: 'same-origin',
			headers: headers,
		}).then(function (res) {
			if (!res.ok) {
				throw new Error('HTTP ' + res.status);
			}
			return res.json();
		}).then(function (json) {
			// NodeBB write API may wrap payloads as `{ status, response }`;
			// unwrap defensively.
			const data = (json && json.response !== undefined) ? json.response : json;
			return {
				questions: Array.isArray(data && data.questions) ? data.questions : [],
				settings: (data && data.settings) || {},
				gateAck: !!(data && data.gateAck),
			};
		});
	}

	/**
	 * Wire up the rules-ack screen interactions.
	 */
	function setupRulesScreen() {
		const checkbox = document.getElementById('rq-rules-ack-checkbox');
		const btn = document.getElementById('rq-rules-ack-btn');
		if (!checkbox || !btn) return;

		// Sync disabled state at init (not just on change) — covers the case
		// where the browser restored a checked state from a bfcache navigation.
		btn.disabled = !checkbox.checked;

		checkbox.addEventListener('change', function () {
			btn.disabled = !checkbox.checked;
		});

		// Ensure clicks anywhere on the rules card that target the checkbox
		// label toggle it; the `<label>` wrapper already does this natively,
		// but make the experience explicit and resilient to CSS that might
		// cover the input with another element.
		const card = document.querySelector('#rulesquiz-rules .rq-card');
		if (card) {
			card.addEventListener('click', function (ev) {
				const target = ev.target;
				if (!target) return;
				// Don't interfere with native checkbox/label behaviour.
				if (target === checkbox) return;
				if (target.closest && target.closest('label.rq-checkbox')) return;
				if (target.closest && target.closest('a,button,input,textarea,select')) return;
			});
		}

		btn.addEventListener('click', function () {
			if (!checkbox.checked) return;
			btn.disabled = true;
			ackRules().then(function () {
				state.gateAck = true;
				if (state.settings && state.settings.intro && state.settings.intro.show) {
					showScreen(SCREEN_INTRO);
				} else {
					startQuiz();
				}
			}).catch(function (err) {
				btn.disabled = false;
				alerts.error(err && err.message ? err.message : '[[rulesquiz:error.locked]]');
			});
		});
	}

	/**
	 * Wire up the intro "Start" button.
	 */
	function setupIntroScreen() {
		const btn = document.getElementById('rq-intro-start-btn');
		if (!btn) return;
		btn.addEventListener('click', function () {
			startQuiz();
		});
	}

	/**
	 * Wire up the quiz prev/next/submit buttons. Idempotent.
	 */
	function setupQuizScreen() {
		const prev = document.getElementById('rq-prev-btn');
		const next = document.getElementById('rq-next-btn');
		const submit = document.getElementById('rq-submit-btn');
		if (prev && !prev.dataset.wired) {
			prev.dataset.wired = '1';
			prev.addEventListener('click', function () {
				collectAnswer();
				if (state.idx > 0) {
					state.idx -= 1;
					renderQuestion();
				}
			});
		}
		if (next && !next.dataset.wired) {
			next.dataset.wired = '1';
			next.addEventListener('click', function () {
				collectAnswer();
				if (state.idx < state.questions.length - 1) {
					state.idx += 1;
					renderQuestion();
				}
			});
		}
		if (submit && !submit.dataset.wired) {
			submit.dataset.wired = '1';
			submit.addEventListener('click', function () {
				collectAnswer();
				submit.disabled = true;
				doSubmit().catch(function (err) {
					submit.disabled = false;
					alerts.error(err && err.message ? err.message : '[[rulesquiz:fail]]');
				});
			});
		}
	}

	/**
	 * Begin (or restart) the quiz: reset state and render question 0.
	 */
	function startQuiz() {
		state.idx = 0;
		state.answers = state.answers || {};

		// Defensive: never mount an empty quiz — show a friendly message
		// instead of a blank prev/next UI. See DEBUG.md §H5.
		if (!Array.isArray(state.questions) || state.questions.length === 0) {
			showEmptyState();
			return;
		}

		showScreen(SCREEN_QUIZ);
		// Restore the quiz header in case a previous empty/loading state hid it.
		const header = document.querySelector('#rulesquiz-quiz .rq-quiz-header');
		if (header) header.style.display = '';
		setupQuizScreen();

		const limit = state.settings && state.settings.quiz && state.settings.quiz.timeLimitSec;
		if (limit && limit > 0) {
			startTimer(limit);
		}
		renderQuestion();
	}

	/**
	 * Fisher-Yates shuffle (in-place). Used optionally for answer options.
	 *
	 * @template T
	 * @param {T[]} arr
	 * @returns {T[]}
	 */
	function shuffle(arr) {
		for (let i = arr.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
		}
		return arr;
	}

	/**
	 * Escape a string for safe inclusion in HTML text content.
	 *
	 * @param {*} s
	 * @returns {string}
	 */
	function esc(s) {
		if (s === null || s === undefined) return '';
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	/**
	 * Render the current question into `#rq-question` and update the
	 * progress bar / footer button visibility.
	 */
	function renderQuestion() {
		const container = document.getElementById('rq-question');
		if (!container) return;
		const q = state.questions[state.idx];
		if (!q) {
			container.innerHTML = '';
			return;
		}

		const total = state.questions.length;
		const idx = state.idx;
		const pct = total > 0 ? Math.round(((idx + 1) / total) * 100) : 0;
		const bar = document.getElementById('rq-progress-bar');
		const ptxt = document.getElementById('rq-progress-text');
		const progressEl = bar && bar.parentElement;
		if (bar) bar.style.width = pct + '%';
		if (ptxt) ptxt.textContent = (idx + 1) + ' / ' + total;
		if (progressEl) progressEl.setAttribute('aria-valuenow', String(pct));

		const prev = document.getElementById('rq-prev-btn');
		const next = document.getElementById('rq-next-btn');
		const submit = document.getElementById('rq-submit-btn');
		if (prev) prev.disabled = idx === 0;
		if (next) next.hidden = idx >= total - 1;
		if (submit) submit.hidden = idx < total - 1;

		const parts = [];
		parts.push('<h2 class="rq-question-title">' + esc(q.title) + '</h2>');
		if (q.bodyHtml) {
			parts.push('<div class="rq-question-body">' + q.bodyHtml + '</div>');
		} else if (q.bodyMarkdown) {
			parts.push('<pre class="rq-question-body rq-question-body--plain">' + esc(q.bodyMarkdown) + '</pre>');
		}
		if (q.imageUrl) {
			parts.push('<img class="rq-question-image" src="' + esc(q.imageUrl) + '" alt="" />');
		}
		if (q.ruleLinkUrl) {
			parts.push('<p class="rq-question-rulelink"><a href="' + esc(q.ruleLinkUrl) + '" target="_blank" rel="noopener">' + esc(q.ruleLinkUrl) + '</a></p>');
		}

		const inputName = 'rq-q-' + esc(String(q.qid));
		const prior = state.answers[q.qid];

		if (q.type === 'freetext') {
			const val = typeof prior === 'string' ? prior : '';
			parts.push('<div class="rq-options"><input type="text" class="rq-input rq-freetext" name="' + inputName + '" value="' + esc(val) + '" autocomplete="off" /></div>');
		} else {
			let options = Array.isArray(q.options) ? q.options.slice() : [];
			if (q.type === 'truefalse' && options.length === 0) {
				options = [
					{ id: 'true', text: 'True' },
					{ id: 'false', text: 'False' },
				];
			}
			const shuffleOpts = state.settings && state.settings.quiz && state.settings.quiz.shuffleAnswers;
			if (shuffleOpts && q.type !== 'truefalse') {
				shuffle(options);
			}

			const inputType = q.type === 'multi' ? 'checkbox' : 'radio';
			const optHtml = ['<div class="rq-options">'];
			for (let i = 0; i < options.length; i++) {
				const opt = options[i];
				const oid = String(opt.id);
				let checked = false;
				if (q.type === 'multi') {
					checked = Array.isArray(prior) && prior.indexOf(oid) !== -1;
				} else {
					checked = prior === oid;
				}
				optHtml.push(
					'<label class="rq-option">' +
						'<input type="' + inputType + '" name="' + inputName + '" value="' + esc(oid) + '"' + (checked ? ' checked' : '') + ' />' +
						'<span class="rq-option-text">' + esc(opt.text) + '</span>' +
					'</label>'
				);
			}
			optHtml.push('</div>');
			parts.push(optHtml.join(''));
		}

		container.innerHTML = parts.join('');
	}

	/**
	 * Read the current question's user input and store it in `state.answers`.
	 */
	function collectAnswer() {
		const q = state.questions[state.idx];
		if (!q) return;
		const inputName = 'rq-q-' + String(q.qid);
		const inputs = document.querySelectorAll('#rq-question [name="rq-q-' + cssEscape(String(q.qid)) + '"]');
		if (q.type === 'freetext') {
			if (inputs.length > 0) {
				state.answers[q.qid] = inputs[0].value || '';
			}
			return;
		}
		if (q.type === 'multi') {
			const picked = [];
			for (let i = 0; i < inputs.length; i++) {
				if (inputs[i].checked) picked.push(inputs[i].value);
			}
			state.answers[q.qid] = picked;
			return;
		}
		// single, truefalse
		for (let i = 0; i < inputs.length; i++) {
			if (inputs[i].checked) {
				state.answers[q.qid] = inputs[i].value;
				return;
			}
		}
		// no selection -> leave undefined / clear
		if (state.answers[q.qid] !== undefined) delete state.answers[q.qid];
	}

	/**
	 * Minimal CSS attribute-selector escaper for our numeric/string qids.
	 *
	 * @param {string} s
	 * @returns {string}
	 */
	function cssEscape(s) {
		return String(s).replace(/(["\\])/g, '\\$1');
	}

	/**
	 * Begin the quiz countdown timer; auto-submit on expiry.
	 *
	 * @param {number} seconds Initial duration.
	 */
	function startTimer(seconds) {
		stopTimer();
		const el = document.getElementById('rq-timer');
		if (!el) return;
		el.hidden = false;
		let remaining = seconds;
		function paint() {
			const m = Math.floor(remaining / 60);
			const s = remaining % 60;
			el.textContent = m + ':' + (s < 10 ? '0' : '') + s;
		}
		paint();
		timerHandle = setInterval(function () {
			remaining -= 1;
			if (remaining <= 0) {
				stopTimer();
				el.textContent = '0:00';
				collectAnswer();
				const submitBtn = document.getElementById('rq-submit-btn');
				if (submitBtn) submitBtn.disabled = true;
				doSubmit().catch(function (err) {
					alerts.error(err && err.message ? err.message : '[[rulesquiz:fail]]');
				});
				return;
			}
			paint();
		}, 1000);
	}

	function stopTimer() {
		if (timerHandle) {
			clearInterval(timerHandle);
			timerHandle = null;
		}
	}

	/**
	 * POST the rules-ack to the server.
	 *
	 * @returns {Promise<object>}
	 */
	function ackRules() {
		return apiPost(API_BASE + '/ack', {});
	}

	/**
	 * POST the collected answers to the server and render the result.
	 *
	 * @returns {Promise<void>}
	 */
	function doSubmit() {
		return apiPost(API_BASE + '/submit', { answers: state.answers }).then(function (resp) {
			stopTimer();
			renderResult(resp || {});
		});
	}

	/**
	 * Thin POST wrapper that adds NodeBB's CSRF token and parses JSON.
	 *
	 * @param {string} url
	 * @param {object} body
	 * @returns {Promise<object>}
	 */
	function apiPost(url, body) {
		const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
		try {
			if (typeof config !== 'undefined' && config && config.csrf_token) {
				headers['X-CSRF-Token'] = config.csrf_token;
			}
		} catch (_) { /* no-op */ }
		return fetch(url, {
			method: 'POST',
			credentials: 'same-origin',
			headers: headers,
			body: JSON.stringify(body || {}),
		}).then(function (res) {
			return res.json().then(function (json) {
				if (!res.ok) {
					const msg = (json && (json.message || json.error)) || ('HTTP ' + res.status);
					const err = new Error(msg);
					err.response = json;
					throw err;
				}
				// NodeBB write API wraps payloads as `{ status, response }`.
				if (json && json.response !== undefined) return json.response;
				return json;
			});
		});
	}

	/**
	 * Render the result template into the result-screen container and
	 * activate it. Wires up retry / cooldown handlers based on outcome.
	 *
	 * @param {object} resp Server response from `/submit`.
	 */
	function renderResult(resp) {
		const passed = !!resp.passed;
		const mode = (state.settings && state.settings.onFail && state.settings.onFail.mode) || 'retry';
		let showRetry = false;
		let showCooldown = false;
		let showLocked = false;
		let showDailyLimit = false;
		let cooldownText = '';
		let cooldownMs = 0;

		if (!passed) {
			if (resp.reason === 'locked' || mode === 'lock_after_attempts') {
				showLocked = true;
			} else if (resp.reason === 'daily_limit' || mode === 'daily_limit') {
				showDailyLimit = true;
			} else if (resp.reason === 'cooldown' || mode === 'cooldown') {
				showCooldown = true;
				cooldownMs = (typeof resp.retryAfterMs === 'number' && resp.retryAfterMs > 0)
					? resp.retryAfterMs
					: ((state.settings && state.settings.onFail && state.settings.onFail.cooldownSec) || 0) * 1000;
				cooldownText = formatCooldown(cooldownMs);
			} else {
				showRetry = true;
			}
		}

		const data = {
			passed: passed,
			score: resp.score || 0,
			total: resp.total || 0,
			perQuestion: Array.isArray(resp.perQuestion) ? resp.perQuestion : [],
			redirectTo: resp.redirectTo || (state.settings && state.settings.onSuccess && state.settings.onSuccess.redirectTo) || '/',
			showRetry: showRetry,
			showCooldown: showCooldown,
			showLocked: showLocked,
			showDailyLimit: showDailyLimit,
			cooldownText: cooldownText,
		};

		Benchpress.parse('quiz/result', data, function (html) {
			translator.translate(html, function (translated) {
				const container = document.getElementById('rulesquiz-result');
				if (!container) return;
				container.innerHTML = translated;
				showScreen(SCREEN_RESULT);

				if (passed) {
					setTimeout(function () {
						window.location.href = data.redirectTo;
					}, 3000);
					return;
				}

				if (showRetry) {
					const retryBtn = document.getElementById('rq-retry-btn');
					if (retryBtn) {
						retryBtn.addEventListener('click', function () {
							state.answers = {};
							startQuiz();
						});
					}
				}

				if (showCooldown && cooldownMs > 0) {
					startCooldownCountdown(cooldownMs);
				}
			});
		});
	}

	/**
	 * Format a cooldown duration as `Mm Ss` (e.g. `4m 12s`).
	 *
	 * @param {number} ms
	 * @returns {string}
	 */
	function formatCooldown(ms) {
		const total = Math.max(0, Math.ceil(ms / 1000));
		const m = Math.floor(total / 60);
		const s = total % 60;
		if (m > 0) return m + 'm ' + s + 's';
		return s + 's';
	}

	/**
	 * Tick a countdown until the cooldown is over, then re-enable retry.
	 *
	 * @param {number} ms
	 */
	function startCooldownCountdown(ms) {
		if (cooldownHandle) clearInterval(cooldownHandle);
		const el = document.getElementById('rq-cooldown-timer');
		if (!el) return;
		let remaining = ms;
		el.textContent = formatCooldown(remaining);
		cooldownHandle = setInterval(function () {
			remaining -= 1000;
			if (remaining <= 0) {
				clearInterval(cooldownHandle);
				cooldownHandle = null;
				el.textContent = formatCooldown(0);
				const wrap = el.parentElement;
				if (wrap) {
					wrap.innerHTML = '';
					const btn = document.createElement('button');
					btn.type = 'button';
					btn.id = 'rq-retry-btn';
					btn.className = 'rq-btn rq-btn--primary';
					btn.textContent = '';
					translator.translate('[[rulesquiz:result.try_again]]', function (t) {
						btn.textContent = t;
					});
					btn.addEventListener('click', function () {
						state.answers = {};
						startQuiz();
					});
					wrap.appendChild(btn);
				}
				return;
			}
			el.textContent = formatCooldown(remaining);
		}, 1000);
	}

	/**
	 * Build the initial client state from a bootstrap payload (either the
	 * inline JSON block or a fetched API response).
	 *
	 * @param {object} boot
	 */
	function hydrateState(boot) {
		state = {
			questions: Array.isArray(boot.questions) ? boot.questions : [],
			settings: boot.settings || {},
			gateAck: !!boot.gateAck,
			rtl: !!boot.rtl,
			lang: boot.lang || 'en-GB',
			idx: 0,
			answers: {},
		};
	}

	/**
	 * Heuristic: is the bootstrap effectively empty (meaning the template
	 * filters likely failed to expand)?
	 *
	 * @param {object} boot
	 * @returns {boolean}
	 */
	function isBootstrapEmpty(boot) {
		const settingsEmpty = !boot || !boot.settings || !Object.keys(boot.settings).length;
		const questionsEmpty = !boot || !Array.isArray(boot.questions) || boot.questions.length === 0;
		return settingsEmpty || questionsEmpty;
	}

	/**
	 * Full init routine. Factored out so we can retry it after an error.
	 */
	function runInit() {
		const boot = readBootstrap();
		hydrateState(boot);

		// Wire up screens that exist in the DOM up-front — cheap and idempotent.
		setupRulesScreen();
		setupIntroScreen();
		setupQuizScreen();

		if (isBootstrapEmpty(boot)) {
			// Fall back to the API — this covers NodeBB versions where the
			// Benchpress `:json` filter isn't available and the inline JSON
			// ends up as literal `{questions:json}` / `{settings:json}`.
			showLoadingState();
			fetchBootstrap().then(function (fetched) {
				hydrateState({
					questions: fetched.questions,
					settings: fetched.settings,
					gateAck: fetched.gateAck || boot.gateAck,
					rtl: boot.rtl,
					lang: boot.lang,
				});
				// Re-wire now that state is real (some handlers read settings).
				setupRulesScreen();
				setupIntroScreen();
				setupQuizScreen();
				decideInitialScreen();
			}).catch(function (err) {
				if (window.console) console.error('[rules-quiz] bootstrap fetch failed:', err);
				showErrorState(function () { runInit(); });
			});
			return;
		}

		decideInitialScreen();
	}

	return {
		/**
		 * Entry point invoked by NodeBB's page-loader when `/quiz` mounts.
		 */
		init: function () {
			if (!document.getElementById('rulesquiz-app')) return;
			runInit();
		},
	};
});

// Register the same module under the names NodeBB's auto-loader tries to
// resolve for the `/quiz` route (template path is `quiz/index.tpl`, so the
// loader asks RequireJS for `forum/quiz/index`). Without this shim the page
// load errors out early and our inline bootstrap never runs.
(function () {
	function shim(name) {
		define(name, ['forum/plugins/rules-quiz'], function (mod) { return mod; });
	}
	shim('forum/quiz/index');
	shim('forum/quiz/result');
})();
