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
