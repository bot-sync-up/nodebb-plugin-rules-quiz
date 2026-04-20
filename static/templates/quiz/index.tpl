<style>
/* v0.3.0 — full friendly visual refresh. Works even without the LESS bundle. */
#rulesquiz-app{max-width:780px;margin:2rem auto;padding:0 1rem;font-size:16px;line-height:1.6;box-sizing:border-box;color:#1f2933}
#rulesquiz-app *,#rulesquiz-app *::before,#rulesquiz-app *::after{box-sizing:border-box}
#rulesquiz-app .rq-screen{display:none}
#rulesquiz-app .rq-screen.active{display:block}
#rulesquiz-app .rq-card{background:#fff;border:1px solid #e4e7eb;border-radius:18px;padding:2rem 2.25rem;box-shadow:0 10px 40px rgba(17,24,39,.06),0 2px 6px rgba(17,24,39,.03)}
@media (max-width:600px){#rulesquiz-app .rq-card{padding:1.5rem 1.25rem;border-radius:14px}}
#rulesquiz-app .rq-heading{margin:0 0 1rem;font-size:1.7em;font-weight:700;letter-spacing:-.01em;line-height:1.3;display:flex;align-items:center;gap:.6rem}
#rulesquiz-app #rulesquiz-rules .rq-heading::before{content:"📖";font-size:1em}
#rulesquiz-app #rulesquiz-intro .rq-heading::before{content:"👋";font-size:1em}
#rulesquiz-app #rulesquiz-quiz .rq-heading::before{content:"❓";font-size:1em}
#rulesquiz-app .rq-actions{margin-top:1.5rem;display:flex;gap:.6rem;flex-wrap:wrap}
#rulesquiz-app button.rq-btn,#rulesquiz-app a.rq-btn{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:.4rem!important;padding:.8rem 1.5rem!important;border-radius:10px!important;border:1px solid transparent!important;background:#fff!important;cursor:pointer!important;font:inherit!important;font-weight:600!important;color:#1f2933!important;transition:all .15s ease!important;min-height:46px!important;text-decoration:none!important;line-height:1.4!important;box-sizing:border-box!important}
#rulesquiz-app button.rq-btn:hover:not([disabled]){transform:translateY(-1px)}
#rulesquiz-app button.rq-btn--primary,#rulesquiz-app a.rq-btn--primary{background:linear-gradient(135deg,#4f7cff,#3b5fe2)!important;color:#fff!important;border-color:#3b5fe2!important;box-shadow:0 2px 8px rgba(79,124,255,.35)!important}
#rulesquiz-app button.rq-btn--primary:hover:not([disabled]),#rulesquiz-app a.rq-btn--primary:hover:not([disabled]){background:linear-gradient(135deg,#3b5fe2,#2d4ac0)!important;box-shadow:0 4px 14px rgba(79,124,255,.45)!important}
#rulesquiz-app button.rq-btn--ghost,#rulesquiz-app a.rq-btn--ghost{background:#fff!important;color:#475569!important;border-color:#cbd5e1!important}
#rulesquiz-app button.rq-btn--ghost:hover:not([disabled]){background:#f1f5f9!important;border-color:#94a3b8!important}
#rulesquiz-app button.rq-btn[disabled]{opacity:.45!important;cursor:not-allowed!important;transform:none!important;box-shadow:none!important}
#rulesquiz-app button.rq-btn[hidden]{display:none!important}
#rulesquiz-app .rq-checkbox{display:flex;align-items:center;gap:.7rem;margin:1.25rem 0;padding:.85rem 1.1rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;cursor:pointer;font-weight:500;transition:all .15s ease}
#rulesquiz-app .rq-checkbox:hover{background:#f1f5f9;border-color:#cbd5e1}
#rulesquiz-app .rq-checkbox input[type="checkbox"]{width:1.25rem;height:1.25rem;margin:0;cursor:pointer;accent-color:#4f7cff}
#rulesquiz-app .rq-rules-body,#rulesquiz-app .rq-intro-body{margin:1rem 0 1.25rem;padding:1.25rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;max-height:55vh;overflow:auto;line-height:1.65}
#rulesquiz-app .rq-rules-body--plain,#rulesquiz-app .rq-intro-body--plain{white-space:pre-wrap;font-family:inherit}
#rulesquiz-app .rq-rules-body h1,#rulesquiz-app .rq-rules-body h2,#rulesquiz-app .rq-rules-body h3{margin-top:1.2em;font-weight:700}
#rulesquiz-app .rq-rules-body h2{font-size:1.3em;color:#1e293b}
#rulesquiz-app .rq-rules-body ul,#rulesquiz-app .rq-rules-body ol{padding-inline-start:1.6em;margin:.5em 0}
#rulesquiz-app .rq-rules-body li{margin:.35em 0}
#rulesquiz-app .rq-rules-body a{color:#4f7cff;text-decoration:underline}
#rulesquiz-app .rq-rules-link{margin:1rem 0 0;font-size:.92em;color:#64748b}
#rulesquiz-app .rq-rules-link a{color:#4f7cff;text-decoration:underline;font-weight:500}
#rulesquiz-app .rq-quiz-meta{display:flex;justify-content:space-between;align-items:center;margin:.5rem 0 1rem;font-size:.95em;color:#64748b}
#rulesquiz-app .rq-progress-text{font-weight:600;color:#334155}
#rulesquiz-app .rq-progress{height:10px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin:0 0 1.5rem}
#rulesquiz-app .rq-progress-bar{height:100%;background:linear-gradient(90deg,#4f7cff,#7c9aff);width:0;transition:width .4s cubic-bezier(.22,1,.36,1);border-radius:999px}
#rulesquiz-app .rq-question{margin:1.25rem 0}
#rulesquiz-app .rq-question-title{font-size:1.3em;font-weight:600;margin:0 0 1rem;line-height:1.4;color:#0f172a}
#rulesquiz-app .rq-question-body{margin:.5rem 0 1rem;color:#475569;line-height:1.6}
#rulesquiz-app .rq-question-image{max-width:100%;border-radius:10px;margin:.75rem 0;box-shadow:0 4px 12px rgba(0,0,0,.08)}
#rulesquiz-app .rq-question-rulelink{margin:.75rem 0 1rem;font-size:.9em;color:#64748b}
#rulesquiz-app .rq-question-rulelink a{color:#4f7cff;text-decoration:underline}
#rulesquiz-app .rq-options{display:flex;flex-direction:column;gap:.75rem;margin-top:1.25rem}
#rulesquiz-app .rq-option{display:flex;align-items:center;gap:.85rem;padding:1rem 1.2rem;border:2px solid #e2e8f0;border-radius:12px;cursor:pointer;transition:all .15s ease;background:#fff}
#rulesquiz-app .rq-option:hover{background:#f8fafc;border-color:#94a3b8}
#rulesquiz-app .rq-option input[type="radio"],#rulesquiz-app .rq-option input[type="checkbox"]{margin:0;flex-shrink:0;width:1.2rem;height:1.2rem;cursor:pointer;accent-color:#4f7cff}
#rulesquiz-app .rq-option:has(input:checked){border-color:#4f7cff;background:#eff4ff;box-shadow:0 2px 8px rgba(79,124,255,.2)}
#rulesquiz-app .rq-option:has(input:checked) .rq-option-text{color:#1e40af;font-weight:600}
#rulesquiz-app .rq-option-text{flex:1;line-height:1.5;color:#334155}
#rulesquiz-app .rq-input{width:100%;padding:.85rem 1rem;border:2px solid #e2e8f0;border-radius:10px;font:inherit;transition:border-color .15s ease}
#rulesquiz-app .rq-input:focus{outline:none;border-color:#4f7cff;box-shadow:0 0 0 3px rgba(79,124,255,.15)}
#rulesquiz-app .rq-timer{font-variant-numeric:tabular-nums;font-weight:700;color:#0f172a;background:#f1f5f9;padding:.2rem .6rem;border-radius:6px}
#rulesquiz-app .rq-empty,#rulesquiz-app .rq-loading{text-align:center;padding:3rem 1rem;color:#64748b}
#rulesquiz-app .rq-empty h2,#rulesquiz-app .rq-loading h2{color:#334155;margin-bottom:.5rem}
#rulesquiz-app .rq-quiz-footer{display:flex;gap:.6rem;margin-top:1.5rem;justify-content:space-between}
#rulesquiz-app[dir="rtl"] .rq-actions,#rulesquiz-app[dir="rtl"] .rq-quiz-footer{flex-direction:row-reverse}
#rulesquiz-app[dir="rtl"] .rq-option{text-align:right}
#rulesquiz-app[dir="rtl"] .rq-rules-body ul,#rulesquiz-app[dir="rtl"] .rq-rules-body ol{padding-inline-start:0;padding-inline-end:1.6em}
/* Result screen */
#rulesquiz-app .rq-result{text-align:center;padding:1rem 0}
#rulesquiz-app .rq-result-icon{font-size:4.5rem;line-height:1;margin:.5rem 0 1rem;display:inline-block;animation:rq-pop .5s ease}
@keyframes rq-pop{0%{transform:scale(.3);opacity:0}60%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
#rulesquiz-app .rq-result h2{font-size:1.9em;margin:0 0 .5rem;font-weight:700}
#rulesquiz-app .rq-result-passed h2{color:#16a34a}
#rulesquiz-app .rq-result-failed h2{color:#dc2626}
#rulesquiz-app .rq-result-score{font-size:1.25em;color:#475569;margin:.75rem 0 1.5rem;font-weight:500}
#rulesquiz-app .rq-result-score strong{color:#0f172a;font-size:1.15em}
#rulesquiz-app .rq-result-percent{display:inline-block;padding:.3rem .8rem;border-radius:999px;font-size:.88em;margin-inline-start:.5rem;font-weight:700}
#rulesquiz-app .rq-result-passed .rq-result-percent{background:#dcfce7;color:#166534}
#rulesquiz-app .rq-result-failed .rq-result-percent{background:#fee2e2;color:#991b1b}
#rulesquiz-app .rq-result-msg{max-width:500px;margin:1rem auto 1.75rem;color:#475569;line-height:1.65}
#rulesquiz-app .rq-result .rq-actions{justify-content:center}
#rulesquiz-app .rq-cooldown-counter{font-variant-numeric:tabular-nums;font-weight:700;color:#dc2626;background:#fee2e2;padding:.4rem .9rem;border-radius:8px;display:inline-block;margin-top:.5rem}
/* Per-question breakdown */
#rulesquiz-app .rq-pq-list{margin:2rem auto 0;max-width:640px;text-align:start}
#rulesquiz-app .rq-pq-heading{font-size:1.15em;font-weight:700;margin:0 0 1rem;color:#334155;text-align:center}
#rulesquiz-app .rq-pq{border:1px solid #e2e8f0;border-radius:10px;margin:.5rem 0;background:#fff;overflow:hidden}
#rulesquiz-app .rq-pq.rq-pq-correct{border-color:#86efac;background:#f0fdf4}
#rulesquiz-app .rq-pq.rq-pq-wrong{border-color:#fca5a5;background:#fef2f2}
#rulesquiz-app .rq-pq summary{padding:.75rem 1rem;cursor:pointer;display:flex;align-items:center;gap:.5rem;font-weight:500;list-style:none}
#rulesquiz-app .rq-pq summary::-webkit-details-marker{display:none}
#rulesquiz-app .rq-pq summary::after{content:"▸";margin-inline-start:auto;transition:transform .2s ease;opacity:.5}
#rulesquiz-app .rq-pq[open] summary::after{transform:rotate(90deg)}
#rulesquiz-app[dir="rtl"] .rq-pq summary::after{content:"◂"}
#rulesquiz-app[dir="rtl"] .rq-pq[open] summary::after{transform:rotate(-90deg)}
#rulesquiz-app .rq-pq-icon{flex-shrink:0}
#rulesquiz-app .rq-pq-num{font-weight:700;color:#64748b;min-width:1.5rem}
#rulesquiz-app .rq-pq-title{flex:1;color:#1e293b}
#rulesquiz-app .rq-pq-body{padding:.25rem 1rem 1rem;border-top:1px solid rgba(0,0,0,.06);font-size:.95em}
#rulesquiz-app .rq-pq-row{margin:.5rem 0;display:flex;flex-wrap:wrap;gap:.35rem}
#rulesquiz-app .rq-pq-label{color:#64748b;font-weight:600;min-width:110px}
#rulesquiz-app .rq-pq-value{color:#0f172a}
#rulesquiz-app .rq-pq-correct-text{color:#166534;font-weight:600;background:#dcfce7;padding:.05rem .5rem;border-radius:6px}
#rulesquiz-app .rq-pq-explain{margin-top:.6rem;padding:.6rem .8rem;background:rgba(79,124,255,.08);border-inline-start:3px solid #4f7cff;border-radius:6px;color:#334155;line-height:1.55}
#rulesquiz-app .rq-pq-rulelink{color:#4f7cff;text-decoration:underline;margin-inline-start:.5rem;white-space:nowrap}
</style>

<div id="rulesquiz-app" class="rulesquiz-container" dir="{{{ if rtl }}}rtl{{{ else }}}ltr{{{ end }}}" lang="{lang}">

	<section id="rulesquiz-rules" class="rq-screen" hidden style="display:none">
		<div class="rq-card">
			<h1 class="rq-heading">[[rulesquiz:rules.heading]]</h1>

			{{{ if rulesHtml }}}
			<div class="rq-rules-body">{rulesHtml}</div>
			{{{ else }}}
				{{{ if settings.rules.rulesText }}}
				<pre class="rq-rules-body rq-rules-body--plain">{settings.rules.rulesText}</pre>
				{{{ end }}}
			{{{ end }}}

			{{{ if settings.rules.rulesUrl }}}
			{{{ if !rulesHtml }}}
			<p class="rq-rules-link">
				[[rulesquiz:rules.also_on_forum]]
				<a href="{settings.rules.rulesUrl}" target="_blank" rel="noopener">[[rulesquiz:rules.open_thread]]</a>
			</p>
			{{{ end }}}
			{{{ end }}}

			<label class="rq-checkbox">
				<input type="checkbox" id="rq-rules-ack-checkbox" />
				<span>[[rulesquiz:rules.ack_btn]]</span>
			</label>

			<div class="rq-actions">
				<button type="button" id="rq-rules-ack-btn" class="rq-btn rq-btn--primary" disabled>
					[[rulesquiz:rules.ack_btn]]
				</button>
			</div>
		</div>
	</section>

	<section id="rulesquiz-intro" class="rq-screen" hidden style="display:none">
		<div class="rq-card">
			<h1 class="rq-heading">[[rulesquiz:intro.heading]]</h1>

			{{{ if introHtml }}}
			<div class="rq-intro-body">{introHtml}</div>
			{{{ else }}}
				{{{ if settings.intro.markdown }}}
				<pre class="rq-intro-body rq-intro-body--plain">{settings.intro.markdown}</pre>
				{{{ end }}}
			{{{ end }}}

			<div class="rq-actions">
				<button type="button" id="rq-intro-start-btn" class="rq-btn rq-btn--primary">
					[[rulesquiz:start]]
				</button>
			</div>
		</div>
	</section>

	<section id="rulesquiz-quiz" class="rq-screen" hidden style="display:none">
		<div class="rq-card">
			<header class="rq-quiz-header">
				<h1 class="rq-heading">[[rulesquiz:title]]</h1>
				<div class="rq-quiz-meta">
					<span id="rq-timer" class="rq-timer" hidden></span>
					<span id="rq-progress-text" class="rq-progress-text"></span>
				</div>
				<div class="rq-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
					<div id="rq-progress-bar" class="rq-progress-bar"></div>
				</div>
			</header>

			<div id="rq-question" class="rq-question"></div>

			<footer class="rq-quiz-footer">
				<button type="button" id="rq-prev-btn" class="rq-btn rq-btn--ghost">[[rulesquiz:prev]]</button>
				<button type="button" id="rq-next-btn" class="rq-btn rq-btn--primary">[[rulesquiz:next]]</button>
				<button type="button" id="rq-submit-btn" class="rq-btn rq-btn--primary" hidden>[[rulesquiz:submit]]</button>
			</footer>
		</div>
	</section>

	<div id="rulesquiz-result" class="rq-screen" hidden style="display:none"></div>

	<script type="application/json" id="rulesquiz-bootstrap">{"questions":{questionsJson},"settings":{settingsJson},"gateAck":{{{ if gateAck }}}true{{{ else }}}false{{{ end }}},"rtl":{{{ if rtl }}}true{{{ else }}}false{{{ end }}},"lang":"{lang}"}</script>
</div>

<script>
// Boot the quiz module explicitly — NodeBB does not auto-init plugin-scoped
// AMD modules, so we request + invoke it here once the template mounts.
(function () {
	function boot() {
		if (typeof require !== 'function') return;
		require(['forum/plugins/rules-quiz'], function (mod) {
			if (mod && typeof mod.init === 'function') {
				try { mod.init(); } catch (e) { if (window.console) console.error('[rules-quiz] init failed:', e); }
			}
		}, function (err) {
			if (window.console) console.error('[rules-quiz] module not loaded:', err);
		});
	}
	if (window.$ && window.$.fn) {
		$(window).one('action:ajaxify.end', boot);
	}
	// Fallback for direct page loads / older NodeBB versions.
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot);
	} else {
		boot();
	}
})();
</script>
