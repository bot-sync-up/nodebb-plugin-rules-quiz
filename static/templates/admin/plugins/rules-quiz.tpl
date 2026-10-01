<div class="acp-page-container">
<div class="rules-quiz-acp">

	<div class="row">
		<div class="col-12">
			<h1 class="rq-page-title">{t.admin_title}</h1>
			<p class="text-muted rq-page-sub">{t.admin_subtitle}</p>
		</div>
	</div>

	<div class="rq-status-panel" id="rq-status-panel">
		<span class="rq-status-title">{t.admin_status_title}:</span>
		<span class="rq-status-item">
			<span class="rq-status-label">{t.admin_status_enabled}</span>
			<span class="rq-status-badge" data-status="enabled">--</span>
		</span>
		<span class="rq-status-item">
			<span class="rq-status-label">{t.admin_status_questions}</span>
			<span class="rq-status-badge" data-status="questions">--</span>
		</span>
		<span class="rq-status-item">
			<span class="rq-status-label">{t.admin_status_rulesUrl}</span>
			<span class="rq-status-badge" data-status="rulesUrl">--</span>
		</span>
		<span class="rq-status-item">
			<span class="rq-status-label">{t.admin_status_store}</span>
			<span class="rq-status-badge" data-status="store">--</span>
		</span>
	</div>

	<ul class="nav nav-tabs rq-tabs" role="tablist">
		<li class="nav-item" role="presentation">
			<a class="nav-link active" data-toggle="tab" data-bs-toggle="tab" href="#rq-tab-settings" role="tab">
				{t.admin_settings}
			</a>
		</li>
		<li class="nav-item" role="presentation">
			<a class="nav-link" data-toggle="tab" data-bs-toggle="tab" href="#rq-tab-questions" role="tab">
				{t.admin_questions} <span class="badge bg-secondary badge-secondary rq-question-count">{questionCount}</span>
			</a>
		</li>
		<li class="nav-item" role="presentation">
			<a class="nav-link" data-toggle="tab" data-bs-toggle="tab" href="#rq-tab-users" role="tab">
				{t.admin_users}
			</a>
		</li>
		<li class="nav-item" role="presentation">
			<a class="nav-link" data-toggle="tab" data-bs-toggle="tab" href="#rq-tab-reports" role="tab">
				{t.admin_reports}
			</a>
		</li>
	</ul>

	<div class="tab-content rq-tab-content">

		<!-- ============== SETTINGS TAB ============== -->
		<div class="tab-pane fade show active" id="rq-tab-settings" role="tabpanel">
			<form role="form" class="rules-quiz-settings">

				<div class="rq-card">
					<h3>{t.admin_section_general}</h3>
					<div class="form-check form-switch rq-row">
						<input type="checkbox" class="form-check-input" id="rq-enabled" data-field="enabled">
						<label class="form-check-label" for="rq-enabled">{t.admin_field_enabled}</label>
					</div>
					<div class="form-group rq-row">
						<label for="rq-blockMode">{t.admin_field_blockMode}</label>
						<select class="form-control" id="rq-blockMode" data-field="blockMode">
							<option value="block_write">{t.admin_opt_block_write}</option>
							<option value="block_all">{t.admin_opt_block_all}</option>
						</select>
					</div>
					<div class="form-group rq-row">
						<label for="rq-notifyAdminOnFails">{t.admin_field_notifyAdminOnFails}</label>
						<input type="number" min="0" class="form-control" id="rq-notifyAdminOnFails" data-field="notifyAdminOnFails">
					</div>
					<div class="form-check form-switch rq-row">
						<input type="checkbox" class="form-check-input" id="rq-logFullAnswers" data-field="logFullAnswers">
						<label class="form-check-label" for="rq-logFullAnswers">{t.admin_field_logFullAnswers}</label>
					</div>
					<div class="form-check form-switch rq-row">
						<input type="checkbox" class="form-check-input" id="rq-showStatusBadge" data-field="showStatusBadge">
						<label class="form-check-label" for="rq-showStatusBadge">{t.admin_field_showStatusBadge}</label>
					</div>
				</div>

				<div class="rq-card">
					<h3>{t.admin_section_appliesTo}</h3>
					<div class="form-check form-switch rq-row">
						<input type="checkbox" class="form-check-input" id="rq-newUsers" data-field="appliesTo.newUsers">
						<label class="form-check-label" for="rq-newUsers">{t.admin_field_newUsers}</label>
					</div>
					<div class="form-check form-switch rq-row">
						<input type="checkbox" class="form-check-input" id="rq-existingUsers" data-field="appliesTo.existingUsers">
						<label class="form-check-label" for="rq-existingUsers">{t.admin_field_existingUsers}</label>
					</div>
					<div class="form-group rq-row">
						<label for="rq-appliesGroups">{t.admin_field_appliesGroups}</label>
						<input type="text" class="form-control" id="rq-appliesGroups" data-field="appliesTo.groups" data-type="csv" placeholder="registered-users, members">
					</div>
					<div class="form-group rq-row">
						<label for="rq-minReputation">{t.admin_field_minReputation}</label>
						<input type="number" class="form-control" id="rq-minReputation" data-field="appliesTo.minReputation" data-type="numberOrNull">
					</div>
					<div class="form-group rq-row">
						<label for="rq-joinedAfter">{t.admin_field_joinedAfter}</label>
						<input type="date" class="form-control" id="rq-joinedAfter" data-field="appliesTo.joinedAfter">
					</div>
					<div class="form-group rq-row">
						<label for="rq-joinedBefore">{t.admin_field_joinedBefore}</label>
						<input type="date" class="form-control" id="rq-joinedBefore" data-field="appliesTo.joinedBefore">
					</div>
					<div class="form-group rq-row">
						<label for="rq-exemptGroups">{t.admin_field_exemptGroups}</label>
						<input type="text" class="form-control" id="rq-exemptGroups" data-field="exemptGroups" data-type="csv" placeholder="administrators, Global Moderators">
					</div>
					<div class="form-group rq-row">
						<label for="rq-exemptMinReputation">{t.admin_field_exemptMinReputation}</label>
						<input type="number" min="0" class="form-control" id="rq-exemptMinReputation" data-field="exemptMinReputation" data-type="numberOrNull" placeholder="0 = disabled">
					</div>
					<div class="form-group rq-row">
						<label for="rq-exemptPaths">{t.admin_field_exemptPaths}</label>
						<input type="text" class="form-control" id="rq-exemptPaths" data-field="exemptPaths" data-type="csv" placeholder="/login, /register, /quiz">
					</div>
				</div>

				<div class="rq-card">
					<h3>{t.admin_section_rules}</h3>
					<div class="form-check form-switch rq-row">
						<input type="checkbox" class="form-check-input" id="rq-showRulesGate" data-field="rules.showRulesGate">
						<label class="form-check-label" for="rq-showRulesGate">{t.admin_field_showRulesGate}</label>
					</div>
					<div class="form-group rq-row">
						<label for="rq-rulesUrl">{t.admin_field_rulesUrl}</label>
						<input type="text" class="form-control" id="rq-rulesUrl" data-field="rules.rulesUrl" placeholder="/topic/5489">
					</div>
					<div class="form-group rq-row">
						<label for="rq-rulesText">{t.admin_field_rulesText}</label>
						<textarea class="form-control" id="rq-rulesText" data-field="rules.rulesText" rows="6" placeholder="# Markdown allowed"></textarea>
					</div>
					<div class="form-group rq-row">
						<label for="rq-ackButtonText">{t.admin_field_ackButtonText}</label>
						<input type="text" class="form-control" id="rq-ackButtonText" data-field="rules.ackButtonText">
					</div>
				</div>

				<div class="rq-card">
					<h3>{t.admin_section_intro}</h3>
					<div class="form-check form-switch rq-row">
						<input type="checkbox" class="form-check-input" id="rq-introShow" data-field="intro.show">
						<label class="form-check-label" for="rq-introShow">{t.admin_field_introShow}</label>
					</div>
					<div class="form-group rq-row">
						<label for="rq-introMarkdown">{t.admin_field_introMarkdown}</label>
						<textarea class="form-control" id="rq-introMarkdown" data-field="intro.markdown" rows="5"></textarea>
					</div>
				</div>

				<div class="rq-card">
					<h3>{t.admin_section_quiz}</h3>
					<div class="form-group rq-row">
						<label for="rq-sampleSize">{t.admin_field_sampleSize}</label>
						<input type="number" min="0" class="form-control" id="rq-sampleSize" data-field="quiz.sampleSize">
						<small class="form-text text-muted">{t.admin_help_sampleSize}</small>
					</div>
					<div class="form-check form-switch rq-row">
						<input type="checkbox" class="form-check-input" id="rq-shuffleQuestions" data-field="quiz.shuffleQuestions">
						<label class="form-check-label" for="rq-shuffleQuestions">{t.admin_field_shuffleQuestions}</label>
					</div>
					<div class="form-check form-switch rq-row">
						<input type="checkbox" class="form-check-input" id="rq-shuffleAnswers" data-field="quiz.shuffleAnswers">
						<label class="form-check-label" for="rq-shuffleAnswers">{t.admin_field_shuffleAnswers}</label>
					</div>
					<div class="form-group rq-row">
						<label for="rq-passMode">{t.admin_field_passMode}</label>
						<select class="form-control" id="rq-passMode" data-field="quiz.passMode">
							<option value="all">{t.admin_opt_all}</option>
							<option value="percent">{t.admin_opt_percent}</option>
							<option value="min_correct">{t.admin_opt_min_correct}</option>
						</select>
					</div>
					<div class="form-group rq-row">
						<label for="rq-passPercent">{t.admin_field_passPercent}</label>
						<input type="number" min="0" max="100" class="form-control" id="rq-passPercent" data-field="quiz.passPercent">
					</div>
					<div class="form-group rq-row">
						<label for="rq-passMinCorrect">{t.admin_field_passMinCorrect}</label>
						<input type="number" min="0" class="form-control" id="rq-passMinCorrect" data-field="quiz.passMinCorrect">
					</div>
					<div class="form-group rq-row">
						<label for="rq-timeLimitSec">{t.admin_field_timeLimitSec}</label>
						<input type="number" min="0" class="form-control" id="rq-timeLimitSec" data-field="quiz.timeLimitSec">
						<small class="form-text text-muted">{t.admin_help_timeLimitSec}</small>
					</div>
				</div>

				<div class="rq-card">
					<h3>{t.admin_section_onFail}</h3>
					<div class="form-group rq-row">
						<label for="rq-onFailMode">{t.admin_field_onFailMode}</label>
						<select class="form-control" id="rq-onFailMode" data-field="onFail.mode">
							<option value="retry">{t.admin_opt_retry}</option>
							<option value="cooldown">{t.admin_opt_cooldown}</option>
							<option value="lock_after_attempts">{t.admin_opt_lock_after_attempts}</option>
							<option value="daily_limit">{t.admin_opt_daily_limit}</option>
						</select>
					</div>
					<div class="form-group rq-row">
						<label for="rq-cooldownSec">{t.admin_field_cooldownSec}</label>
						<input type="number" min="0" class="form-control" id="rq-cooldownSec" data-field="onFail.cooldownSec">
					</div>
					<div class="form-group rq-row">
						<label for="rq-maxAttemptsPerDay">{t.admin_field_maxAttemptsPerDay}</label>
						<input type="number" min="0" class="form-control" id="rq-maxAttemptsPerDay" data-field="onFail.maxAttemptsPerDay">
					</div>
					<div class="form-group rq-row">
						<label for="rq-lockAfterAttempts">{t.admin_field_lockAfterAttempts}</label>
						<input type="number" min="0" class="form-control" id="rq-lockAfterAttempts" data-field="onFail.lockAfterAttempts">
					</div>
				</div>

				<div class="rq-card">
					<h3>{t.admin_section_onSuccess}</h3>
					<div class="form-group rq-row">
						<label for="rq-addToGroup">{t.admin_field_addToGroup}</label>
						<input type="text" class="form-control" id="rq-addToGroup" data-field="onSuccess.addToGroup" placeholder="verified-users">
					</div>
					<div class="form-check form-switch rq-row">
						<input type="checkbox" class="form-check-input" id="rq-onSuccessNotify" data-field="onSuccess.notify">
						<label class="form-check-label" for="rq-onSuccessNotify">{t.admin_field_onSuccessNotify}</label>
					</div>
					<div class="form-group rq-row">
						<label for="rq-redirectTo">{t.admin_field_redirectTo}</label>
						<input type="text" class="form-control" id="rq-redirectTo" data-field="onSuccess.redirectTo">
					</div>
				</div>

				<div class="rq-card">
					<h3>{t.admin_section_onRefuse}</h3>
					<div class="form-group rq-row">
						<label for="rq-onRefuseMode">{t.admin_field_onRefuseMode}</label>
						<select class="form-control" id="rq-onRefuseMode" data-field="onRefuse.mode">
							<option value="block_write">{t.admin_opt_block_write}</option>
							<option value="banner_only">{t.admin_opt_banner_only}</option>
							<option value="block_all">{t.admin_opt_block_all}</option>
						</select>
					</div>
				</div>

				<div class="rq-card">
					<h3>{t.admin_section_postGate}</h3>
					<div class="form-check form-switch rq-row">
						<input type="checkbox" class="form-check-input" id="rq-postGate-enabled" data-field="postGate.enabled">
						<label class="form-check-label" for="rq-postGate-enabled">{t.admin_field_postGateEnabled}</label>
					</div>
					<div class="form-group rq-row">
						<label for="rq-postGate-applyForFirstN">{t.admin_field_postGateApplyForFirstN}</label>
						<input type="number" min="0" class="form-control" id="rq-postGate-applyForFirstN" data-field="postGate.applyForFirstN">
						<small class="form-text text-muted">{t.admin_help_postGateApplyForFirstN}</small>
					</div>
					<div class="form-group rq-row">
						<label for="rq-postGate-sampleSize">{t.admin_field_postGateSampleSize}</label>
						<input type="number" min="0" class="form-control" id="rq-postGate-sampleSize" data-field="postGate.sampleSize">
					</div>
					<div class="form-group rq-row">
						<label for="rq-postGate-passPercent">{t.admin_field_postGatePassPercent}</label>
						<input type="number" min="0" max="100" class="form-control" id="rq-postGate-passPercent" data-field="postGate.passPercent">
					</div>
					<div class="form-group rq-row">
						<label for="rq-postGate-cooldownSec">{t.admin_field_postGateCooldownSec}</label>
						<input type="number" min="0" class="form-control" id="rq-postGate-cooldownSec" data-field="postGate.cooldownSec">
					</div>
					<div class="form-group rq-row">
						<label for="rq-postGate-onFailMode">{t.admin_field_postGateOnFailMode}</label>
						<select class="form-control" id="rq-postGate-onFailMode" data-field="postGate.onFailMode">
							<option value="retry">{t.admin_opt_retry}</option>
							<option value="cooldown">{t.admin_opt_cooldown}</option>
							<option value="lock_after_attempts">{t.admin_opt_lock_after_attempts}</option>
							<option value="daily_limit">{t.admin_opt_daily_limit}</option>
						</select>
					</div>
					<div class="form-group rq-row">
						<label for="rq-postGate-lockAfterAttempts">{t.admin_field_postGateLockAfterAttempts}</label>
						<input type="number" min="0" class="form-control" id="rq-postGate-lockAfterAttempts" data-field="postGate.lockAfterAttempts">
					</div>
				</div>

				<div class="rq-card">
					<h3>{t.admin_section_topicGate}</h3>
					<div class="form-check form-switch rq-row">
						<input type="checkbox" class="form-check-input" id="rq-topicGate-enabled" data-field="topicGate.enabled">
						<label class="form-check-label" for="rq-topicGate-enabled">{t.admin_field_topicGateEnabled}</label>
					</div>
					<div class="form-group rq-row">
						<label for="rq-topicGate-applyForFirstN">{t.admin_field_topicGateApplyForFirstN}</label>
						<input type="number" min="0" class="form-control" id="rq-topicGate-applyForFirstN" data-field="topicGate.applyForFirstN">
						<small class="form-text text-muted">{t.admin_help_topicGateApplyForFirstN}</small>
					</div>
					<div class="form-group rq-row">
						<label for="rq-topicGate-sampleSize">{t.admin_field_topicGateSampleSize}</label>
						<input type="number" min="0" class="form-control" id="rq-topicGate-sampleSize" data-field="topicGate.sampleSize">
					</div>
					<div class="form-group rq-row">
						<label for="rq-topicGate-passPercent">{t.admin_field_topicGatePassPercent}</label>
						<input type="number" min="0" max="100" class="form-control" id="rq-topicGate-passPercent" data-field="topicGate.passPercent">
					</div>
					<div class="form-group rq-row">
						<label for="rq-topicGate-cooldownSec">{t.admin_field_topicGateCooldownSec}</label>
						<input type="number" min="0" class="form-control" id="rq-topicGate-cooldownSec" data-field="topicGate.cooldownSec">
					</div>
					<div class="form-group rq-row">
						<label for="rq-topicGate-onFailMode">{t.admin_field_topicGateOnFailMode}</label>
						<select class="form-control" id="rq-topicGate-onFailMode" data-field="topicGate.onFailMode">
							<option value="retry">{t.admin_opt_retry}</option>
							<option value="cooldown">{t.admin_opt_cooldown}</option>
							<option value="lock_after_attempts">{t.admin_opt_lock_after_attempts}</option>
							<option value="daily_limit">{t.admin_opt_daily_limit}</option>
						</select>
					</div>
					<div class="form-group rq-row">
						<label for="rq-topicGate-lockAfterAttempts">{t.admin_field_topicGateLockAfterAttempts}</label>
						<input type="number" min="0" class="form-control" id="rq-topicGate-lockAfterAttempts" data-field="topicGate.lockAfterAttempts">
					</div>
				</div>

				<div class="rq-card">
					<h3>{t.admin_section_pool}</h3>
					<div class="form-group rq-row">
						<label for="rq-pool-mode">{t.admin_field_poolMode}</label>
						<select class="form-control" id="rq-pool-mode" data-field="pool.mode">
							<option value="single_tagged">{t.admin_opt_pool_single_tagged}</option>
						</select>
						<small class="form-text text-muted">{t.admin_help_poolMode}</small>
					</div>
				</div>

				<div class="rq-actions">
					<button type="button" class="btn btn-outline-secondary btn-default rq-test-save-btn" id="rq-test-save" title="{t.admin_test_save_help}">
						<i class="fa fa-flask"></i> {t.admin_test_save}
					</button>
					<button type="button" class="btn btn-primary" id="rq-save-settings">
						<i class="fa fa-save"></i> {t.admin_save}
					</button>
				</div>
			</form>
		</div>

		<!-- ============== QUESTIONS TAB ============== -->
		<div class="tab-pane fade" id="rq-tab-questions" role="tabpanel">
			<div class="rq-card">
				<div class="rq-toolbar">
					<button type="button" class="btn btn-success" id="rq-add-question">
						<i class="fa fa-plus"></i> {t.admin_add_question}
					</button>
					<button type="button" class="btn btn-default btn-outline-secondary" id="rq-import-question">
						<i class="fa fa-upload"></i> {t.admin_import}
					</button>
					<a href="/api/v3/plugins/rules-quiz/admin/questions?format=export" class="btn btn-default btn-outline-secondary" id="rq-export-question" target="_blank" rel="noopener">
						<i class="fa fa-download"></i> {t.admin_export}
					</a>
				</div>
				<div class="table-responsive">
					<table class="table table-striped rq-questions-table">
						<thead>
							<tr>
								<th style="width:60px">{t.admin_col_sort}</th>
								<th style="width:100px">{t.admin_col_type}</th>
								<th>{t.admin_col_title}</th>
								<th>{t.admin_col_tags}</th>
								<th style="width:160px">{t.admin_col_actions}</th>
							</tr>
						</thead>
						<tbody id="rq-questions-tbody">
							<tr><td colspan="5" class="text-center text-muted">{t.admin_loading}</td></tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>

		<!-- ============== USERS TAB ============== -->
			<div class="tab-pane fade" id="rq-tab-users" role="tabpanel">
				<div class="rq-card">
					<h3>{t.admin_users_lookup}</h3>
					<div class="form-inline rq-lookup-form">
						<label for="rq-user-search-input">{t.admin_field_uid}</label>
						<input type="number" class="form-control" id="rq-user-search-input" min="1" placeholder="123">
						<button type="button" class="btn btn-primary" id="rq-user-search-btn">
							<i class="fa fa-search"></i> {t.admin_users_search}
						</button>
					</div>

					<div class="rq-user-panel hidden d-none" id="rq-user-panel">
						<div class="rq-user-head">
							<strong class="rq-user-username" id="rq-user-username">--</strong>
							<span class="text-muted">(uid <span id="rq-user-uid">--</span>)</span>
							<a href="#" target="_blank" rel="noopener" id="rq-user-profile-link" class="btn btn-xs btn-sm btn-default btn-outline-secondary">
								<i class="fa fa-external-link"></i> {t.admin_users_profile}
							</a>
						</div>

						<div class="rq-user-stats">
							<div class="rq-stat-chip">
								<span class="rq-stat-label">{t.admin_users_status}</span>
								<span class="rq-stat-value" id="rq-user-status">--</span>
							</div>
							<div class="rq-stat-chip">
								<span class="rq-stat-label">{t.admin_users_attempts}</span>
								<span class="rq-stat-value" id="rq-user-attempts">--</span>
							</div>
							<div class="rq-stat-chip">
								<span class="rq-stat-label">{t.admin_users_postsCreated}</span>
								<span class="rq-stat-value" id="rq-user-postsCreated">--</span>
							</div>
							<div class="rq-stat-chip">
								<span class="rq-stat-label">{t.admin_users_topicsCreated}</span>
								<span class="rq-stat-value" id="rq-user-topicsCreated">--</span>
							</div>
							<div class="rq-stat-chip">
								<span class="rq-stat-label">{t.admin_users_gateAck}</span>
								<span class="rq-stat-value" id="rq-user-gateAck">--</span>
							</div>
							<div class="rq-stat-chip">
								<span class="rq-stat-label">{t.admin_users_postTokenExp}</span>
								<span class="rq-stat-value" id="rq-user-postTokenExp">--</span>
							</div>
							<div class="rq-stat-chip">
								<span class="rq-stat-label">{t.admin_users_topicTokenExp}</span>
								<span class="rq-stat-value" id="rq-user-topicTokenExp">--</span>
							</div>
						</div>

						<div class="rq-user-actions">
							<button type="button" class="btn btn-default btn-outline-secondary" id="rq-user-reset-counters-btn">
								<i class="fa fa-refresh"></i> {t.admin_users_reset_counters}
							</button>
							<button type="button" class="btn btn-default btn-outline-secondary" id="rq-user-reset-onboarding-btn">
								<i class="fa fa-undo"></i> {t.admin_users_reset_onboarding}
							</button>
							<button type="button" class="btn btn-success" id="rq-user-exempt-btn">
								<i class="fa fa-check"></i> {t.admin_users_exempt}
							</button>
							<button type="button" class="btn btn-warning" id="rq-user-unexempt-btn">
								<i class="fa fa-times"></i> {t.admin_users_unexempt}
							</button>
						</div>

						<h4 class="rq-user-attempts-heading">{t.admin_users_recent_attempts}</h4>
						<div class="table-responsive">
							<table class="table table-striped rq-attempts-table">
								<thead>
									<tr>
										<th>{t.admin_col_aid}</th>
										<th>{t.admin_col_started}</th>
										<th>{t.admin_col_finished}</th>
										<th>{t.admin_col_score}</th>
										<th>{t.admin_col_passed}</th>
									</tr>
								</thead>
								<tbody id="rq-user-attempts-tbody"></tbody>
							</table>
						</div>
					</div>
				</div>
			</div>

			<!-- ============== REPORTS TAB ============== -->
		<div class="tab-pane fade" id="rq-tab-reports" role="tabpanel">
			<div class="row">
				<div class="col-md-4">
					<div class="rq-stat-card rq-stat-passed">
						<div class="rq-stat-label">{t.admin_stat_passed}</div>
						<div class="rq-stat-value" id="rq-stat-passed">--</div>
					</div>
				</div>
				<div class="col-md-4">
					<div class="rq-stat-card rq-stat-failed">
						<div class="rq-stat-label">{t.admin_stat_failed}</div>
						<div class="rq-stat-value" id="rq-stat-failed">--</div>
					</div>
				</div>
				<div class="col-md-4">
					<div class="rq-stat-card rq-stat-neutral">
						<div class="rq-stat-label">{t.admin_stat_range}</div>
						<div class="rq-stat-value" id="rq-stat-range">{t.admin_stat_last30}</div>
					</div>
				</div>
			</div>

			<div class="rq-card">
				<h3>{t.admin_stat_byGate}</h3>
					<div class="rq-gate-breakdown">
						<div class="rq-gate-card">
							<h4>{t.admin_stat_gate_onboarding}</h4>
							<div><span class="rq-pass" id="rq-gate-onboarding-passed">0</span> / <span class="rq-fail" id="rq-gate-onboarding-failed">0</span></div>
						</div>
						<div class="rq-gate-card">
							<h4>{t.admin_stat_gate_post}</h4>
							<div><span class="rq-pass" id="rq-gate-post-passed">0</span> / <span class="rq-fail" id="rq-gate-post-failed">0</span></div>
						</div>
						<div class="rq-gate-card">
							<h4>{t.admin_stat_gate_topic}</h4>
							<div><span class="rq-pass" id="rq-gate-topic-passed">0</span> / <span class="rq-fail" id="rq-gate-topic-failed">0</span></div>
						</div>
					</div>
				</div>

				<div class="rq-card">
					<h3>{t.admin_stat_failingUsers}</h3>
					<ul class="rq-failing-users list-group" id="rq-failing-users-list">
						<li class="list-group-item text-muted">{t.admin_loading}</li>
					</ul>
				</div>

				<div class="rq-card">
					<h3>{t.admin_stat_daily}</h3>
				<div class="rq-chart-wrap">
					<canvas id="rulesquiz-daily-chart" height="120"></canvas>
				</div>
				<div id="rq-daily-fallback" class="rq-daily-fallback hidden d-none"></div>
			</div>

			<div class="rq-card">
				<h3>{t.admin_stat_hardest}</h3>
				<ul class="rq-hardest list-group" id="rq-hardest-list">
					<li class="list-group-item text-muted">{t.admin_loading}</li>
				</ul>
			</div>

			<div class="rq-card">
				<h3>{t.admin_user_lookup}</h3>
				<div class="form-inline rq-lookup-form">
					<label for="rq-lookup-uid">{t.admin_field_uid}</label>
					<input type="number" class="form-control" id="rq-lookup-uid" min="1" placeholder="123">
					<button type="button" class="btn btn-primary" id="rq-lookup-btn">
						{t.admin_show_attempts}
					</button>
				</div>
				<div class="table-responsive">
					<table class="table table-striped rq-attempts-table">
						<thead>
							<tr>
								<th>{t.admin_col_aid}</th>
								<th>{t.admin_col_started}</th>
								<th>{t.admin_col_finished}</th>
								<th>{t.admin_col_score}</th>
								<th>{t.admin_col_passed}</th>
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
					<h5 class="modal-title" id="rq-question-modal-title">{t.admin_add_question}</h5>
					<button type="button" class="close btn-close" data-dismiss="modal" data-bs-dismiss="modal" aria-label="Close">
						<span aria-hidden="true">&times;</span>
					</button>
				</div>
				<div class="modal-body">
					<form class="rq-question-form">
						<input type="hidden" id="rq-q-qid">
						<div class="form-group rq-row">
							<label for="rq-q-type">{t.admin_q_type}</label>
							<select class="form-control" id="rq-q-type">
								<option value="single">{t.admin_q_type_single}</option>
								<option value="multi">{t.admin_q_type_multi}</option>
								<option value="truefalse">{t.admin_q_type_truefalse}</option>
								<option value="freetext">{t.admin_q_type_freetext}</option>
							</select>
						</div>
						<div class="form-group rq-row">
							<label for="rq-q-title">{t.admin_q_title}</label>
							<input type="text" class="form-control" id="rq-q-title" required>
						</div>
						<div class="form-group rq-row">
							<label for="rq-q-body">{t.admin_q_body}</label>
							<textarea class="form-control" id="rq-q-body" rows="3"></textarea>
						</div>
						<div class="form-group rq-row">
							<label for="rq-q-image">{t.admin_q_image}</label>
							<input type="text" class="form-control" id="rq-q-image" placeholder="https://...">
						</div>
						<div class="form-group rq-row">
							<label for="rq-q-rulelink">{t.admin_q_ruleLink}</label>
							<input type="text" class="form-control" id="rq-q-rulelink" placeholder="/topic/5489#rule-3">
						</div>

						<div class="form-group rq-row rq-options-block">
							<label>{t.admin_q_options}</label>
							<div id="rq-q-options"></div>
							<button type="button" class="btn btn-sm btn-default btn-outline-secondary" id="rq-q-add-option">
								<i class="fa fa-plus"></i> {t.admin_q_add_option}
							</button>
						</div>

						<div class="form-group rq-row rq-freetext-block hidden d-none">
							<label for="rq-q-answertext">{t.admin_q_answerText}</label>
							<input type="text" class="form-control" id="rq-q-answertext">
						</div>
						<div class="form-group rq-row rq-freetext-block hidden d-none">
							<label for="rq-q-answerregex">{t.admin_q_answerRegex}</label>
							<input type="text" class="form-control" id="rq-q-answerregex" placeholder="^yes|y$">
						</div>

						<div class="form-group rq-row">
							<label for="rq-q-explanation">{t.admin_q_explanation}</label>
							<textarea class="form-control" id="rq-q-explanation" rows="2"></textarea>
						</div>
						<div class="form-group rq-row">
							<label for="rq-q-weight">{t.admin_q_weight}</label>
							<input type="number" min="0" step="1" class="form-control" id="rq-q-weight" value="1">
						</div>
						<div class="form-group rq-row">
							<label for="rq-q-tags">{t.admin_q_tags}</label>
							<input type="text" class="form-control" id="rq-q-tags" placeholder="off-topic, posting">
						</div>
						<div class="form-group rq-row">
							<label for="rq-q-sort">{t.admin_q_sort}</label>
							<input type="number" class="form-control" id="rq-q-sort" value="100">
						</div>
					</form>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-default btn-outline-secondary" data-dismiss="modal" data-bs-dismiss="modal">
						{t.admin_cancel}
					</button>
					<button type="button" class="btn btn-primary" id="rq-q-save">
						<i class="fa fa-save"></i> {t.admin_save}
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
					<h5 class="modal-title">{t.admin_import}</h5>
					<button type="button" class="close btn-close" data-dismiss="modal" data-bs-dismiss="modal" aria-label="Close">
						<span aria-hidden="true">&times;</span>
					</button>
				</div>
				<div class="modal-body">
					<div class="form-group">
						<label for="rq-import-format">{t.admin_import_format}</label>
						<select class="form-control" id="rq-import-format">
							<option value="json">JSON</option>
							<option value="csv">CSV</option>
						</select>
					</div>
					<div class="form-group">
						<label for="rq-import-file">{t.admin_import_file}</label>
						<input type="file" class="form-control" id="rq-import-file" accept=".json,.csv,application/json,text/csv">
					</div>
					<small class="text-muted">{t.admin_import_help}</small>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-default btn-outline-secondary" data-dismiss="modal" data-bs-dismiss="modal">
						{t.admin_cancel}
					</button>
					<button type="button" class="btn btn-primary" id="rq-import-go">
						<i class="fa fa-upload"></i> {t.admin_import_go}
					</button>
				</div>
			</div>
		</div>
	</div>

</div>
</div>
