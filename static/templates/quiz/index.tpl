<style>
/* Critical inline CSS — makes the page usable even if the plugin's LESS
   bundle isn't loaded yet (e.g. right after activation, before a rebuild). */
#rulesquiz-app{max-width:720px;margin:1.5rem auto;padding:0 1rem;font-size:16px;line-height:1.55;box-sizing:border-box}
#rulesquiz-app *,#rulesquiz-app *::before,#rulesquiz-app *::after{box-sizing:border-box}
#rulesquiz-app .rq-screen{display:none}
#rulesquiz-app .rq-screen.active{display:block}
#rulesquiz-app .rq-card{background:#fff;border:1px solid rgba(0,0,0,.1);border-radius:12px;padding:1.5rem;box-shadow:0 4px 18px rgba(0,0,0,.05)}
#rulesquiz-app .rq-heading{margin:0 0 1rem;font-size:1.6em;font-weight:600}
#rulesquiz-app .rq-actions{margin-top:1.25rem;display:flex;gap:.5rem;flex-wrap:wrap}
#rulesquiz-app .rq-btn{display:inline-block;padding:.55rem 1.1rem;border-radius:8px;border:1px solid rgba(0,0,0,.15);background:#fff;cursor:pointer;font:inherit;color:inherit}
#rulesquiz-app .rq-btn:hover{background:rgba(0,0,0,.04)}
#rulesquiz-app .rq-btn--primary{background:#2d6cdf;color:#fff;border-color:#2058c1}
#rulesquiz-app .rq-btn--primary:hover{background:#2058c1}
#rulesquiz-app .rq-btn[disabled]{opacity:.5;cursor:not-allowed}
#rulesquiz-app .rq-checkbox{display:flex;align-items:center;gap:.5rem;margin:1rem 0}
#rulesquiz-app .rq-rules-body,#rulesquiz-app .rq-intro-body{margin:1rem 0;padding:1rem;background:rgba(0,0,0,.03);border-radius:8px;max-height:50vh;overflow:auto}
#rulesquiz-app .rq-rules-body--plain,#rulesquiz-app .rq-intro-body--plain{white-space:pre-wrap;font-family:inherit}
#rulesquiz-app .rq-rules-body h1,#rulesquiz-app .rq-rules-body h2,#rulesquiz-app .rq-rules-body h3{margin-top:1em}
#rulesquiz-app .rq-rules-body ul,#rulesquiz-app .rq-rules-body ol{padding-inline-start:1.4em}
#rulesquiz-app .rq-progress{height:6px;background:rgba(0,0,0,.08);border-radius:3px;overflow:hidden;margin:.75rem 0 1rem}
#rulesquiz-app .rq-progress-bar{height:100%;background:#2d6cdf;width:0;transition:width .3s}
#rulesquiz-app .rq-quiz-footer{display:flex;gap:.5rem;margin-top:1.25rem;flex-wrap:wrap}
#rulesquiz-app[dir="rtl"] .rq-actions,#rulesquiz-app[dir="rtl"] .rq-quiz-footer{flex-direction:row-reverse}
</style>

<div id="rulesquiz-app" class="rulesquiz-container" dir="{{{ if rtl }}}rtl{{{ else }}}ltr{{{ end }}}" lang="{lang}">

	<section id="rulesquiz-rules" class="rq-screen">
		<div class="rq-card">
			<h1 class="rq-heading">[[rulesquiz:rules.heading]]</h1>

			{{{ if settings.rules.rulesUrl }}}
			<p class="rq-rules-link">
				<a href="{settings.rules.rulesUrl}" target="_blank" rel="noopener">{settings.rules.rulesUrl}</a>
			</p>
			{{{ end }}}

			{{{ if rulesHtml }}}
			<div class="rq-rules-body">{rulesHtml}</div>
			{{{ else }}}
				{{{ if settings.rules.rulesText }}}
				<pre class="rq-rules-body rq-rules-body--plain">{settings.rules.rulesText}</pre>
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

	<section id="rulesquiz-intro" class="rq-screen">
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

	<section id="rulesquiz-quiz" class="rq-screen">
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

	<div id="rulesquiz-result" class="rq-screen"></div>

	<script type="application/json" id="rulesquiz-bootstrap">
		{
			"questions": {questions:json},
			"settings": {settings:json},
			"gateAck": {{{ if gateAck }}}true{{{ else }}}false{{{ end }}},
			"rtl": {{{ if rtl }}}true{{{ else }}}false{{{ end }}},
			"lang": "{lang}"
		}
	</script>
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
