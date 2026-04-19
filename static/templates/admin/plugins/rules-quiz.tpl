<div class="acp-page-container">
<div class="rules-quiz-acp">

	<div class="row">
		<div class="col-12">
			<h1 class="rq-page-title">[[rulesquiz:admin.title]]</h1>
			<p class="text-muted rq-page-sub">[[rulesquiz:admin.subtitle]]</p>
		</div>
	</div>

	<div class="rq-status-panel" id="rq-status-panel">
		<span class="rq-status-title">[[rulesquiz:admin.status.title]]:</span>
		<span class="rq-status-item">
			<span class="rq-status-label">[[rulesquiz:admin.status.enabled]]</span>
			<span class="rq-status-badge" data-status="enabled">--</span>
		</span>
		<span class="rq-status-item">
			<span class="rq-status-label">[[rulesquiz:admin.status.questions]]</span>
			<span class="rq-status-badge" data-status="questions">--</span>
		</span>
		<span class="rq-status-item">
			<span class="rq-status-label">[[rulesquiz:admin.status.rulesUrl]]</span>
			<span class="rq-status-badge" data-status="rulesUrl">--</span>
		</span>
		<span class="rq-status-item">
			<span class="rq-status-label">[[rulesquiz:admin.status.store]]</span>
			<span class="rq-status-badge" data-status="store">--</span>
		</span>
	</div>

	<ul class="nav nav-tabs rq-tabs" role="tablist">
		<li class="nav-item" role="presentation">
			<a class="nav-link active" data-toggle="tab" data-bs-toggle="tab" href="#rq-tab-settings" role="tab">
				[[rulesquiz:admin.settings]]
			</a>
		</li>
		<li class="nav-item" role="presentation">
			<a class="nav-link" data-toggle="tab" data-bs-toggle="tab" href="#rq-tab-questions" role="tab">
				[[rulesquiz:admin.questions]] <span class="badge bg-secondary badge-secondary rq-question-count">{questionCount}</span>
			</a>
		</li>
		<li class="nav-item" role="presentation">
			<a class="nav-link" data-toggle="tab" data-bs-toggle="tab" href="#rq-tab-reports" role="tab">
				[[rulesquiz:admin.reports]]
			</a>
		</li>
	</ul>

	<div class="tab-content rq-tab-content">

		<!-- ============== SETTINGS TAB ============== -->
		<div class="tab-pane fade show active" id="rq-tab-settings" role="tabpanel">
			<form role="form" class="rules-quiz-settings">

				<div class="rq-card">
					<h3>[[rulesquiz:admin.section.general]]</h3>
					<div class="form-check form-switch rq-row">
						<input type="checkbox" class="form-check-input" id="rq-enabled" data-field="enabled">
						<label class="form-check-label" for="rq-enabled">[[rulesquiz:admin.field.enabled]]</label>
					</div>
					<div class="form-group rq-row">
						<label for="rq-blockMode">[[rulesquiz:admin.field.blockMode]]</label>
						<select class="form-control" id="rq-blockMode" data-field="blockMode">
							<option value="modal_soft">[[rulesquiz:admin.opt.modal_soft]]</option>
							<option value="block_write">[[rulesquiz:admin.opt.block_write]]</option>
							<option value="block_all">[[rulesquiz:admin.opt.block_all]]</option>
						</select>
					</div>
					<div class="form-group rq-row">
						<label for="rq-notifyAdminOnFails">[[rulesquiz:admin.field.notifyAdminOnFails]]</label>
						<input type="number" min="0" class="form-control" id="rq-notifyAdminOnFails" data-field="notifyAdminOnFails">
					</div>
					<div class="form-check form-switch rq-row">
						<input type="checkbox" class="form-check-input" id="rq-logFullAnswers" data-field="logFullAnswers">
						<label class="form-check-label" for="rq-logFullAnswers">[[rulesquiz:admin.field.logFullAnswers]]</label>
					</div>
				</div>

				<div class="rq-card">
					<h3>[[rulesquiz:admin.section.appliesTo]]</h3>
					<div class="form-check form-switch rq-row">
						<input type="checkbox" class="form-check-input" id="rq-newUsers" data-field="appliesTo.newUsers">
						<label class="form-check-label" for="rq-newUsers">[[rulesquiz:admin.field.newUsers]]</label>
					</div>
					<div class="form-check form-switch rq-row">
						<input type="checkbox" class="form-check-input" id="rq-existingUsers" data-field="appliesTo.existingUsers">
						<label class="form-check-label" for="rq-existingUsers">[[rulesquiz:admin.field.existingUsers]]</label>
					</div>
					<div class="form-group rq-row">
						<label for="rq-appliesGroups">[[rulesquiz:admin.field.appliesGroups]]</label>
						<input type="text" class="form-control" id="rq-appliesGroups" data-field="appliesTo.groups" data-type="csv" placeholder="registered-users, members">
					</div>
					<div class="form-group rq-row">
						<label for="rq-minReputation">[[rulesquiz:admin.field.minReputation]]</label>
						<input type="number" class="form-control" id="rq-minReputation" data-field="appliesTo.minReputation" data-type="numberOrNull">
					</div>
					<div class="form-group rq-row">
						<label for="rq-joinedAfter">[[rulesquiz:admin.field.joinedAfter]]</label>
						<input type="date" class="form-control" id="rq-joinedAfter" data-field="appliesTo.joinedAfter">
					</div>
					<div class="form-group rq-row">
						<label for="rq-joinedBefore">[[rulesquiz:admin.field.joinedBefore]]</label>
						<input type="date" class="form-control" id="rq-joinedBefore" data-field="appliesTo.joinedBefore">
					</div>
					<div class="form-group rq-row">
						<label for="rq-exemptGroups">[[rulesquiz:admin.field.exemptGroups]]</label>
						<input type="text" class="form-control" id="rq-exemptGroups" data-field="exemptGroups" data-type="csv" placeholder="administrators, Global Moderators">
					</div>
					<div class="form-group rq-row">
						<label for="rq-exemptPaths">[[rulesquiz:admin.field.exemptPaths]]</label>
						<input type="text" class="form-control" id="rq-exemptPaths" data-field="exemptPaths" data-type="csv" placeholder="/login, /register, /quiz">
					</div>
				</div>

				<div class="rq-card">
					<h3>[[rulesquiz:admin.section.rules]]</h3>
					<div class="form-check form-switch rq-row">
						<input type="checkbox" class="form-check-input" id="rq-showRulesGate" data-field="rules.showRulesGate">
						<label class="form-check-label" for="rq-showRulesGate">[[rulesquiz:admin.field.showRulesGate]]</label>
					</div>
					<div class="form-group rq-row">
						<label for="rq-rulesUrl">[[rulesquiz:admin.field.rulesUrl]]</label>
						<input type="text" class="form-control" id="rq-rulesUrl" data-field="rules.rulesUrl" placeholder="/topic/5489">
					</div>
					<div class="form-group rq-row">
						<label for="rq-rulesText">[[rulesquiz:admin.field.rulesText]]</label>
						<textarea class="form-control" id="rq-rulesText" data-field="rules.rulesText" rows="6" placeholder="# Markdown allowed"></textarea>
					</div>
					<div class="form-group rq-row">
						<label for="rq-ackButtonText">[[rulesquiz:admin.field.ackButtonText]]</label>
						<input type="text" class="form-control" id="rq-ackButtonText" data-field="rules.ackButtonText">
					</div>
				</div>

				<div class="rq-card">
					<h3>[[rulesquiz:admin.section.intro]]</h3>
					<div class="form-check form-switch rq-row">
						<input type="checkbox" class="form-check-input" id="rq-introShow" data-field="intro.show">
						<label class="form-check-label" for="rq-introShow">[[rulesquiz:admin.field.introShow]]</label>
					</div>
					<div class="form-group rq-row">
						<label for="rq-introMarkdown">[[rulesquiz:admin.field.introMarkdown]]</label>
						<textarea class="form-control" id="rq-introMarkdown" data-field="intro.markdown" rows="5"></textarea>
					</div>
				</div>

				<div class="rq-card">
					<h3>[[rulesquiz:admin.section.quiz]]</h3>
					<div class="form-group rq-row">
						<label for="rq-sampleSize">[[rulesquiz:admin.field.sampleSize]]</label>
						<input type="number" min="0" class="form-control" id="rq-sampleSize" data-field="quiz.sampleSize">
						<small class="form-text text-muted">[[rulesquiz:admin.help.sampleSize]]</small>
					</div>
					<div class="form-check form-switch rq-row">
						<input type="checkbox" class="form-check-input" id="rq-shuffleQuestions" data-field="quiz.shuffleQuestions">
						<label class="form-check-label" for="rq-shuffleQuestions">[[rulesquiz:admin.field.shuffleQuestions]]</label>
					</div>
					<div class="form-check form-switch rq-row">
						<input type="checkbox" class="form-check-input" id="rq-shuffleAnswers" data-field="quiz.shuffleAnswers">
						<label class="form-check-label" for="rq-shuffleAnswers">[[rulesquiz:admin.field.shuffleAnswers]]</label>
					</div>
					<div class="form-group rq-row">
						<label for="rq-passMode">[[rulesquiz:admin.field.passMode]]</label>
						<select class="form-control" id="rq-passMode" data-field="quiz.passMode">
							<option value="all">[[rulesquiz:admin.opt.all]]</option>
							<option value="percent">[[rulesquiz:admin.opt.percent]]</option>
							<option value="min_correct">[[rulesquiz:admin.opt.min_correct]]</option>
						</select>
					</div>
					<div class="form-group rq-row">
						<label for="rq-passPercent">[[rulesquiz:admin.field.passPercent]]</label>
						<input type="number" min="0" max="100" class="form-control" id="rq-passPercent" data-field="quiz.passPercent">
					</div>
					<div class="form-group rq-row">
						<label for="rq-passMinCorrect">[[rulesquiz:admin.field.passMinCorrect]]</label>
						<input type="number" min="0" class="form-control" id="rq-passMinCorrect" data-field="quiz.passMinCorrect">
					</div>
					<div class="form-group rq-row">
						<label for="rq-timeLimitSec">[[rulesquiz:admin.field.timeLimitSec]]</label>
						<input type="number" min="0" class="form-control" id="rq-timeLimitSec" data-field="quiz.timeLimitSec">
						<small class="form-text text-muted">[[rulesquiz:admin.help.timeLimitSec]]</small>
					</div>
				</div>

				<div class="rq-card">
					<h3>[[rulesquiz:admin.section.onFail]]</h3>
					<div class="form-group rq-row">
						<label for="rq-onFailMode">[[rulesquiz:admin.field.onFailMode]]</label>
						<select class="form-control" id="rq-onFailMode" data-field="onFail.mode">
							<option value="retry">[[rulesquiz:admin.opt.retry]]</option>
							<option value="cooldown">[[rulesquiz:admin.opt.cooldown]]</option>
							<option value="lock_after_attempts">[[rulesquiz:admin.opt.lock_after_attempts]]</option>
							<option value="daily_limit">[[rulesquiz:admin.opt.daily_limit]]</option>
						</select>
					</div>
					<div class="form-group rq-row">
						<label for="rq-cooldownSec">[[rulesquiz:admin.field.cooldownSec]]</label>
						<input type="number" min="0" class="form-control" id="rq-cooldownSec" data-field="onFail.cooldownSec">
					</div>
					<div class="form-group rq-row">
						<label for="rq-maxAttemptsPerDay">[[rulesquiz:admin.field.maxAttemptsPerDay]]</label>
						<input type="number" min="0" class="form-control" id="rq-maxAttemptsPerDay" data-field="onFail.maxAttemptsPerDay">
					</div>
					<div class="form-group rq-row">
						<label for="rq-lockAfterAttempts">[[rulesquiz:admin.field.lockAfterAttempts]]</label>
						<input type="number" min="0" class="form-control" id="rq-lockAfterAttempts" data-field="onFail.lockAfterAttempts">
					</div>
				</div>

				<div class="rq-card">
					<h3>[[rulesquiz:admin.section.onSuccess]]</h3>
					<div class="form-group rq-row">
						<label for="rq-addToGroup">[[rulesquiz:admin.field.addToGroup]]</label>
						<input type="text" class="form-control" id="rq-addToGroup" data-field="onSuccess.addToGroup" placeholder="verified-users">
					</div>
					<div class="form-check form-switch rq-row">
						<input type="checkbox" class="form-check-input" id="rq-onSuccessNotify" data-field="onSuccess.notify">
						<label class="form-check-label" for="rq-onSuccessNotify">[[rulesquiz:admin.field.onSuccessNotify]]</label>
					</div>
					<div class="form-group rq-row">
						<label for="rq-redirectTo">[[rulesquiz:admin.field.redirectTo]]</label>
						<input type="text" class="form-control" id="rq-redirectTo" data-field="onSuccess.redirectTo">
					</div>
				</div>

				<div class="rq-card">
					<h3>[[rulesquiz:admin.section.onRefuse]]</h3>
					<div class="form-group rq-row">
						<label for="rq-onRefuseMode">[[rulesquiz:admin.field.onRefuseMode]]</label>
						<select class="form-control" id="rq-onRefuseMode" data-field="onRefuse.mode">
							<option value="block_write">[[rulesquiz:admin.opt.block_write]]</option>
							<option value="banner_only">[[rulesquiz:admin.opt.banner_only]]</option>
							<option value="block_all">[[rulesquiz:admin.opt.block_all]]</option>
						</select>
					</div>
				</div>

				<div class="rq-actions">
					<button type="button" class="btn btn-outline-secondary btn-default rq-test-save-btn" id="rq-test-save" title="[[rulesquiz:admin.test_save_help]]">
						<i class="fa fa-flask"></i> [[rulesquiz:admin.test_save]]
					</button>
					<button type="button" class="btn btn-primary" id="rq-save-settings">
						<i class="fa fa-save"></i> [[rulesquiz:admin.save]]
					</button>
				</div>
			</form>
		</div>

		<!-- ============== QUESTIONS TAB ============== -->
		<div class="tab-pane fade" id="rq-tab-questions" role="tabpanel">
			<div class="rq-card">
				<div class="rq-toolbar">
					<button type="button" class="btn btn-success" id="rq-add-question">
						<i class="fa fa-plus"></i> [[rulesquiz:admin.add_question]]
					</button>
					<button type="button" class="btn btn-default btn-outline-secondary" id="rq-import-question">
						<i class="fa fa-upload"></i> [[rulesquiz:admin.import]]
					</button>
					<a href="/api/v3/plugins/rules-quiz/admin/questions?format=export" class="btn btn-default btn-outline-secondary" id="rq-export-question" target="_blank" rel="noopener">
						<i class="fa fa-download"></i> [[rulesquiz:admin.export]]
					</a>
				</div>
				<div class="table-responsive">
					<table class="table table-striped rq-questions-table">
						<thead>
							<tr>
								<th style="width:60px">[[rulesquiz:admin.col.sort]]</th>
								<th style="width:100px">[[rulesquiz:admin.col.type]]</th>
								<th>[[rulesquiz:admin.col.title]]</th>
								<th>[[rulesquiz:admin.col.tags]]</th>
								<th style="width:160px">[[rulesquiz:admin.col.actions]]</th>
							</tr>
						</thead>
						<tbody id="rq-questions-tbody">
							<tr><td colspan="5" class="text-center text-muted">[[rulesquiz:admin.loading]]</td></tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>

		<!-- ============== REPORTS TAB ============== -->
		<div class="tab-pane fade" id="rq-tab-reports" role="tabpanel">
			<div class="row">
				<div class="col-md-4">
					<div class="rq-stat-card rq-stat-passed">
						<div class="rq-stat-label">[[rulesquiz:admin.stat.passed]]</div>
						<div class="rq-stat-value" id="rq-stat-passed">--</div>
					</div>
				</div>
				<div class="col-md-4">
					<div class="rq-stat-card rq-stat-failed">
						<div class="rq-stat-label">[[rulesquiz:admin.stat.failed]]</div>
						<div class="rq-stat-value" id="rq-stat-failed">--</div>
					</div>
				</div>
				<div class="col-md-4">
					<div class="rq-stat-card rq-stat-neutral">
						<div class="rq-stat-label">[[rulesquiz:admin.stat.range]]</div>
						<div class="rq-stat-value" id="rq-stat-range">[[rulesquiz:admin.stat.last30]]</div>
					</div>
				</div>
			</div>

			<div class="rq-card">
				<h3>[[rulesquiz:admin.stat.daily]]</h3>
				<div class="rq-chart-wrap">
					<canvas id="rulesquiz-daily-chart" height="120"></canvas>
				</div>
				<div id="rq-daily-fallback" class="rq-daily-fallback hidden d-none"></div>
			</div>

			<div class="rq-card">
				<h3>[[rulesquiz:admin.stat.hardest]]</h3>
				<ul class="rq-hardest list-group" id="rq-hardest-list">
					<li class="list-group-item text-muted">[[rulesquiz:admin.loading]]</li>
				</ul>
			</div>

			<div class="rq-card">
				<h3>[[rulesquiz:admin.user_lookup]]</h3>
				<div class="form-inline rq-lookup-form">
					<label for="rq-lookup-uid">[[rulesquiz:admin.field.uid]]</label>
					<input type="number" class="form-control" id="rq-lookup-uid" min="1" placeholder="123">
					<button type="button" class="btn btn-primary" id="rq-lookup-btn">
						[[rulesquiz:admin.show_attempts]]
					</button>
				</div>
				<div class="table-responsive">
					<table class="table table-striped rq-attempts-table">
						<thead>
							<tr>
								<th>[[rulesquiz:admin.col.aid]]</th>
								<th>[[rulesquiz:admin.col.started]]</th>
								<th>[[rulesquiz:admin.col.finished]]</th>
								<th>[[rulesquiz:admin.col.score]]</th>
								<th>[[rulesquiz:admin.col.passed]]</th>
							</tr>
						</thead>
						<tbody id="rq-attempts-tbody"></tbody>
					</table>
				</div>
			</div>
		</div>

	</div>

	<!-- ============== QUESTION EDIT MODAL ============== -->
	<div class="modal fade" id="rq-question-modal" tabindex="-1" role="dialog" aria-hidden="true">
		<div class="modal-dialog modal-lg" role="document">
			<div class="modal-content">
				<div class="modal-header">
					<h5 class="modal-title" id="rq-question-modal-title">[[rulesquiz:admin.add_question]]</h5>
					<button type="button" class="close btn-close" data-dismiss="modal" data-bs-dismiss="modal" aria-label="Close">
						<span aria-hidden="true">&times;</span>
					</button>
				</div>
				<div class="modal-body">
					<form class="rq-question-form">
						<input type="hidden" id="rq-q-qid">
						<div class="form-group rq-row">
							<label for="rq-q-type">[[rulesquiz:admin.q.type]]</label>
							<select class="form-control" id="rq-q-type">
								<option value="single">[[rulesquiz:admin.q.type.single]]</option>
								<option value="multi">[[rulesquiz:admin.q.type.multi]]</option>
								<option value="truefalse">[[rulesquiz:admin.q.type.truefalse]]</option>
								<option value="freetext">[[rulesquiz:admin.q.type.freetext]]</option>
							</select>
						</div>
						<div class="form-group rq-row">
							<label for="rq-q-title">[[rulesquiz:admin.q.title]]</label>
							<input type="text" class="form-control" id="rq-q-title" required>
						</div>
						<div class="form-group rq-row">
							<label for="rq-q-body">[[rulesquiz:admin.q.body]]</label>
							<textarea class="form-control" id="rq-q-body" rows="3"></textarea>
						</div>
						<div class="form-group rq-row">
							<label for="rq-q-image">[[rulesquiz:admin.q.image]]</label>
							<input type="text" class="form-control" id="rq-q-image" placeholder="https://...">
						</div>
						<div class="form-group rq-row">
							<label for="rq-q-rulelink">[[rulesquiz:admin.q.ruleLink]]</label>
							<input type="text" class="form-control" id="rq-q-rulelink" placeholder="/topic/5489#rule-3">
						</div>

						<div class="form-group rq-row rq-options-block">
							<label>[[rulesquiz:admin.q.options]]</label>
							<div id="rq-q-options"></div>
							<button type="button" class="btn btn-sm btn-default btn-outline-secondary" id="rq-q-add-option">
								<i class="fa fa-plus"></i> [[rulesquiz:admin.q.add_option]]
							</button>
						</div>

						<div class="form-group rq-row rq-freetext-block hidden d-none">
							<label for="rq-q-answertext">[[rulesquiz:admin.q.answerText]]</label>
							<input type="text" class="form-control" id="rq-q-answertext">
						</div>
						<div class="form-group rq-row rq-freetext-block hidden d-none">
							<label for="rq-q-answerregex">[[rulesquiz:admin.q.answerRegex]]</label>
							<input type="text" class="form-control" id="rq-q-answerregex" placeholder="^yes|y$">
						</div>

						<div class="form-group rq-row">
							<label for="rq-q-explanation">[[rulesquiz:admin.q.explanation]]</label>
							<textarea class="form-control" id="rq-q-explanation" rows="2"></textarea>
						</div>
						<div class="form-group rq-row">
							<label for="rq-q-weight">[[rulesquiz:admin.q.weight]]</label>
							<input type="number" min="0" step="1" class="form-control" id="rq-q-weight" value="1">
						</div>
						<div class="form-group rq-row">
							<label for="rq-q-tags">[[rulesquiz:admin.q.tags]]</label>
							<input type="text" class="form-control" id="rq-q-tags" placeholder="off-topic, posting">
						</div>
						<div class="form-group rq-row">
							<label for="rq-q-sort">[[rulesquiz:admin.q.sort]]</label>
							<input type="number" class="form-control" id="rq-q-sort" value="100">
						</div>
					</form>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-default btn-outline-secondary" data-dismiss="modal" data-bs-dismiss="modal">
						[[rulesquiz:admin.cancel]]
					</button>
					<button type="button" class="btn btn-primary" id="rq-q-save">
						<i class="fa fa-save"></i> [[rulesquiz:admin.save]]
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- ============== IMPORT MODAL ============== -->
	<div class="modal fade" id="rq-import-modal" tabindex="-1" role="dialog" aria-hidden="true">
		<div class="modal-dialog" role="document">
			<div class="modal-content">
				<div class="modal-header">
					<h5 class="modal-title">[[rulesquiz:admin.import]]</h5>
					<button type="button" class="close btn-close" data-dismiss="modal" data-bs-dismiss="modal" aria-label="Close">
						<span aria-hidden="true">&times;</span>
					</button>
				</div>
				<div class="modal-body">
					<div class="form-group">
						<label for="rq-import-format">[[rulesquiz:admin.import.format]]</label>
						<select class="form-control" id="rq-import-format">
							<option value="json">JSON</option>
							<option value="csv">CSV</option>
						</select>
					</div>
					<div class="form-group">
						<label for="rq-import-file">[[rulesquiz:admin.import.file]]</label>
						<input type="file" class="form-control" id="rq-import-file" accept=".json,.csv,application/json,text/csv">
					</div>
					<small class="text-muted">[[rulesquiz:admin.import.help]]</small>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-default btn-outline-secondary" data-dismiss="modal" data-bs-dismiss="modal">
						[[rulesquiz:admin.cancel]]
					</button>
					<button type="button" class="btn btn-primary" id="rq-import-go">
						<i class="fa fa-upload"></i> [[rulesquiz:admin.import.go]]
					</button>
				</div>
			</div>
		</div>
	</div>

</div>
</div>
