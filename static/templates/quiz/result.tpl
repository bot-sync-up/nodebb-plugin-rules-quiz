<div class="rq-card rq-result {{{ if passed }}}rq-result--passed{{{ else }}}rq-result--failed{{{ end }}}">

	<div class="rq-result-icon" aria-hidden="true">
		{{{ if passed }}}
		<span class="rq-icon rq-icon--check">&#10003;</span>
		{{{ else }}}
		<span class="rq-icon rq-icon--x">&#10007;</span>
		{{{ end }}}
	</div>

	<h1 class="rq-heading rq-result-heading">
		{{{ if passed }}}[[rulesquiz:result.passed]]{{{ else }}}[[rulesquiz:result.failed]]{{{ end }}}
	</h1>

	<p class="rq-result-score">
		<strong>{score}</strong> / <strong>{total}</strong>
	</p>

	{{{ if perQuestion.length }}}
	<ul class="rq-result-breakdown">
		{{{ each perQuestion }}}
		<li class="rq-result-item {{{ if ./correct }}}rq-result-item--correct{{{ else }}}rq-result-item--wrong{{{ end }}}">
			<div class="rq-result-item-head">
				<span class="rq-result-item-qid">#{./qid}</span>
				<span class="rq-result-item-mark">
					{{{ if ./correct }}}&#10003;{{{ else }}}&#10007;{{{ end }}}
				</span>
			</div>
			{{{ if ./explanation }}}
			<div class="rq-result-item-explanation">{./explanation}</div>
			{{{ end }}}
		</li>
		{{{ end }}}
	</ul>
	{{{ end }}}

	<div class="rq-actions">
		{{{ if passed }}}
		<a href="{redirectTo}" id="rq-continue-btn" class="rq-btn rq-btn--primary">
			[[rulesquiz:result.continue]]
		</a>
		{{{ else }}}
			{{{ if showRetry }}}
			<button type="button" id="rq-retry-btn" class="rq-btn rq-btn--primary">
				[[rulesquiz:result.try_again]]
			</button>
			{{{ end }}}
			{{{ if showCooldown }}}
			<div class="rq-cooldown">
				<span>[[rulesquiz:error.cooldown]]</span>
				<span id="rq-cooldown-timer" class="rq-cooldown-timer">{cooldownText}</span>
			</div>
			{{{ end }}}
			{{{ if showLocked }}}
			<div class="rq-locked">[[rulesquiz:error.locked]]</div>
			{{{ end }}}
			{{{ if showDailyLimit }}}
			<div class="rq-daily-limit">[[rulesquiz:error.daily_limit]]</div>
			{{{ end }}}
		{{{ end }}}
	</div>
</div>
