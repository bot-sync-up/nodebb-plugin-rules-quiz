'use strict';

define('admin/plugins/rules-quiz', ['settings', 'alerts', 'translator'], function (Settings, alerts, translator) {
	var ACP = {};
	var API_BASE = '/api/v3/plugins/rules-quiz/admin';
	var state = {
		settings: null,
		questions: [],
		editingQid: null,
	};

	// ---------------------------------------------------------------
	// helpers
	// ---------------------------------------------------------------

	function getCsrfToken() {
		var token = '';
		try {
			if (window.config && window.config.csrf_token) {
				token = window.config.csrf_token;
			}
		} catch (e) { /* ignore */ }
		if (!token) {
			try {
				var meta = $('meta[name="csrf-token"]').attr('content');
				if (meta) { token = meta; }
			} catch (e) { /* ignore */ }
		}
		if (!token) {
			try {
				if (window.app && window.app.user && window.app.user.csrf_token) {
					token = window.app.user.csrf_token;
				}
			} catch (e) { /* ignore */ }
		}
		return token || '';
	}

	function csrfHeaders() {
		var token = getCsrfToken();
		return token ? { 'x-csrf-token': token } : {};
	}

	function unwrap(resp) {
		if (resp && typeof resp === 'object' && Object.prototype.hasOwnProperty.call(resp, 'response')) {
			return resp.response;
		}
		return resp;
	}

	function apiFetch(method, path, body, opts) {
		opts = opts || {};
		var mutating = method && method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD';
		var token = getCsrfToken();
		if (mutating && !token && !opts.skipCsrfCheck) {
			alerts.error('[[rulesquiz:admin.error.csrf]]');
			return Promise.reject(new Error('Missing CSRF token'));
		}
		var headers = Object.assign({ 'Accept': 'application/json' }, csrfHeaders(), opts.headers || {});
		var init = { method: method, credentials: 'same-origin', headers: headers };
		if (body !== undefined && body !== null) {
			if (body instanceof FormData) {
				init.body = body;
			} else {
				headers['Content-Type'] = 'application/json';
				init.body = JSON.stringify(body);
			}
		}
		return fetch(path, init).then(function (res) {
			if (!res.ok) {
				return res.text().then(function (txt) {
					var displayMsg = txt;
					try {
						var parsed = JSON.parse(txt);
						if (parsed && parsed.status && parsed.status.message) {
							displayMsg = parsed.status.message;
						} else if (parsed && parsed.error) {
							displayMsg = parsed.error;
						} else if (parsed && parsed.message) {
							displayMsg = parsed.message;
						}
					} catch (e) { /* leave txt */ }
					var err = new Error(displayMsg || ('HTTP ' + res.status));
					err.status = res.status;
					err.rawBody = txt;
					throw err;
				});
			}
			if (res.status === 204) { return null; }
			return res.json().catch(function () { return null; });
		});
	}

	function getByPath(obj, path) {
		if (!obj) { return undefined; }
		var parts = path.split('.');
		var cur = obj;
		for (var i = 0; i < parts.length; i += 1) {
			if (cur === null || cur === undefined) { return undefined; }
			cur = cur[parts[i]];
		}
		return cur;
	}

	function setByPath(obj, path, value) {
		var parts = path.split('.');
		var cur = obj;
		for (var i = 0; i < parts.length - 1; i += 1) {
			if (cur[parts[i]] === undefined || cur[parts[i]] === null || typeof cur[parts[i]] !== 'object') {
				cur[parts[i]] = {};
			}
			cur = cur[parts[i]];
		}
		cur[parts[parts.length - 1]] = value;
	}

	function escapeHtml(s) {
		if (s === null || s === undefined) { return ''; }
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	function toCsv(arr) {
		if (!Array.isArray(arr)) { return ''; }
		return arr.join(', ');
	}

	function fromCsv(str) {
		if (!str) { return []; }
		return String(str).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
	}

	function toDateInput(val) {
		if (!val) { return ''; }
		// Accept either ISO string or timestamp.
		var d = (typeof val === 'number') ? new Date(val) : new Date(val);
		if (isNaN(d.getTime())) { return ''; }
		var m = String(d.getMonth() + 1).padStart(2, '0');
		var day = String(d.getDate()).padStart(2, '0');
		return d.getFullYear() + '-' + m + '-' + day;
	}

	function fromDateInput(val) {
		return val ? val : null;
	}

	function flashSaved($scope) {
		try {
			var $fields = ($scope || $('.rules-quiz-settings')).find('[data-field]');
			$fields.addClass('rq-just-saved');
			setTimeout(function () { $fields.removeClass('rq-just-saved'); }, 900);
		} catch (e) { /* ignore */ }
	}

	// ---------------------------------------------------------------
	// plugin status panel
	// ---------------------------------------------------------------

	function updateStatusPanel() {
		var s = state.settings || {};
		var qCount = Array.isArray(state.questions) ? state.questions.length : 0;
		var enabled = !!s.enabled;
		var rulesUrl = (s.rules && s.rules.rulesUrl) ? s.rules.rulesUrl : '';
		var hasRules = !!rulesUrl;

		var $panel = $('#rq-status-panel');
		if (!$panel.length) { return; }

		$panel.find('[data-status="enabled"]')
			.removeClass('rq-badge-ok rq-badge-warn rq-badge-err')
			.addClass(enabled ? 'rq-badge-ok' : 'rq-badge-warn')
			.text(enabled ? '[[rulesquiz:admin.status.on]]' : '[[rulesquiz:admin.status.off]]');

		$panel.find('[data-status="questions"]')
			.removeClass('rq-badge-ok rq-badge-warn rq-badge-err')
			.addClass(qCount > 0 ? 'rq-badge-ok' : 'rq-badge-err')
			.text(String(qCount));

		$panel.find('[data-status="rulesUrl"]')
			.removeClass('rq-badge-ok rq-badge-warn rq-badge-err')
			.addClass(hasRules ? 'rq-badge-ok' : 'rq-badge-warn')
			.text(hasRules ? rulesUrl : '[[rulesquiz:admin.status.missing]]');

		// redis/store status — best-effort. If _meta from settings includes store, use it.
		var storeOk = !!(s && s._meta && s._meta.storeOk);
		// fallback: if we got a settings object at all, assume store is reachable.
		if (!s._meta && state.settings) { storeOk = true; }
		$panel.find('[data-status="store"]')
			.removeClass('rq-badge-ok rq-badge-warn rq-badge-err')
			.addClass(storeOk ? 'rq-badge-ok' : 'rq-badge-warn')
			.text(storeOk ? '[[rulesquiz:admin.status.ok]]' : '[[rulesquiz:admin.status.unknown]]');

		translator.translate($panel.html(), function (t) { $panel.html(t); });
	}

	// ---------------------------------------------------------------
	// settings tab
	// ---------------------------------------------------------------

	function populateSettingsForm(settings) {
		state.settings = settings || {};
		$('.rules-quiz-settings [data-field]').each(function () {
			var $el = $(this);
			var path = $el.attr('data-field');
			var type = $el.attr('data-type');
			var val = getByPath(settings, path);
			if ($el.is(':checkbox')) {
				$el.prop('checked', !!val);
			} else if (type === 'csv') {
				$el.val(toCsv(val));
			} else if ($el.attr('type') === 'date') {
				$el.val(toDateInput(val));
			} else if ($el.attr('type') === 'number') {
				$el.val(val === null || val === undefined ? '' : val);
			} else {
				$el.val(val === null || val === undefined ? '' : val);
			}
		});
		updateStatusPanel();
	}

	function collectSettingsForm() {
		var out = {};
		$('.rules-quiz-settings [data-field]').each(function () {
			var $el = $(this);
			var path = $el.attr('data-field');
			var type = $el.attr('data-type');
			var v;
			if ($el.is(':checkbox')) {
				v = $el.is(':checked');
			} else if (type === 'csv') {
				v = fromCsv($el.val());
			} else if ($el.attr('type') === 'date') {
				v = fromDateInput($el.val());
			} else if (type === 'numberOrNull') {
				var raw = $el.val();
				v = (raw === '' || raw === null) ? null : Number(raw);
			} else if ($el.attr('type') === 'number') {
				var raw2 = $el.val();
				v = (raw2 === '' || raw2 === null) ? 0 : Number(raw2);
			} else {
				v = $el.val();
			}
			setByPath(out, path, v);
		});
		return out;
	}

	function loadSettings() {
		return apiFetch('GET', API_BASE + '/settings').then(function (resp) {
			var settings = unwrap(resp);
			if (settings && typeof settings === 'object' && settings.settings && typeof settings.settings === 'object') {
				settings = settings.settings;
			}
			populateSettingsForm(settings || {});
		}).catch(function (err) {
			alerts.error('[[rulesquiz:admin.error.load_settings]]: ' + (err && err.message ? err.message : err));
		});
	}

	function saveSettings() {
		var payload = collectSettingsForm();
		console.log('[rules-quiz/acp] PUT settings', payload);
		var $btn = $('#rq-save-settings');
		var origHtml = $btn.html();
		$btn.prop('disabled', true);
		$btn.html('<i class="fa fa-spinner fa-spin"></i> [[rulesquiz:admin.saving]]');
		translator.translate($btn.html(), function (t) { $btn.html(t); });

		return apiFetch('PUT', API_BASE + '/settings', payload).then(function (res) {
			console.log('[rules-quiz/acp] PUT response', res);
			var body = unwrap(res);
			if (body && typeof body === 'object' && body.settings && typeof body.settings === 'object') {
				body = body.settings;
			}
			if (body && typeof body === 'object') {
				populateSettingsForm(body);
			}
			alerts.success('[[rulesquiz:admin.saved]]');
			flashSaved($('.rules-quiz-settings'));
		}).catch(function (err) {
			console.error('[rules-quiz/acp] PUT settings failed', err);
			var msg = err && err.message ? err.message : String(err);
			alerts.error('[[rulesquiz:admin.error.save_settings]]: ' + msg);
		}).then(function () {
			$btn.prop('disabled', false);
			$btn.html(origHtml);
		});
	}

	function testSaveRoundtrip() {
		var payload = { enabled: true };
		console.log('[rules-quiz/acp] TEST PUT settings', payload);
		var $btn = $('#rq-test-save');
		var origHtml = $btn.html();
		$btn.prop('disabled', true);
		$btn.html('<i class="fa fa-spinner fa-spin"></i> [[rulesquiz:admin.saving]]');
		translator.translate($btn.html(), function (t) { $btn.html(t); });

		return apiFetch('PUT', API_BASE + '/settings', payload).then(function (res) {
			console.log('[rules-quiz/acp] TEST PUT response', res);
			return apiFetch('GET', API_BASE + '/settings');
		}).then(function (res) {
			console.log('[rules-quiz/acp] TEST GET response', res);
			var body = unwrap(res);
			if (body && typeof body === 'object' && body.settings && typeof body.settings === 'object') {
				body = body.settings;
			}
			var preview;
			try {
				preview = JSON.stringify(body, null, 2);
			} catch (e) {
				preview = String(body);
			}
			if (preview && preview.length > 600) { preview = preview.slice(0, 600) + ' ...'; }
			alerts.success('[[rulesquiz:admin.test_save_ok]]\n' + preview);
			if (body && typeof body === 'object') { populateSettingsForm(body); }
		}).catch(function (err) {
			console.error('[rules-quiz/acp] TEST save failed', err);
			var msg = err && err.message ? err.message : String(err);
			alerts.error('[[rulesquiz:admin.test_save_err]]: ' + msg);
		}).then(function () {
			$btn.prop('disabled', false);
			$btn.html(origHtml);
		});
	}

	// ---------------------------------------------------------------
	// questions tab
	// ---------------------------------------------------------------

	function renderQuestionsTable() {
		var $tbody = $('#rq-questions-tbody');
		if (!state.questions || !state.questions.length) {
			$tbody.html('<tr><td colspan="5" class="text-center text-muted">[[rulesquiz:admin.empty_questions]]</td></tr>');
			translator.translate($tbody.html(), function (translated) { $tbody.html(translated); });
			$('.rq-question-count').text('0');
			updateStatusPanel();
			return;
		}
		var rows = state.questions.map(function (q) {
			var tags = (q.tags || []).map(function (t) {
				return '<span class="badge-tag">' + escapeHtml(t) + '</span>';
			}).join(' ');
			return [
				'<tr data-qid="', escapeHtml(q.qid), '">',
				'<td>', escapeHtml(q.sort != null ? q.sort : ''), '</td>',
				'<td><span class="badge bg-info">', escapeHtml(q.type || ''), '</span></td>',
				'<td>', escapeHtml(q.title || ''), '</td>',
				'<td>', tags, '</td>',
				'<td>',
				'<button type="button" class="btn btn-xs btn-sm btn-primary rq-q-edit"><i class="fa fa-pencil"></i></button> ',
				'<button type="button" class="btn btn-xs btn-sm btn-danger rq-q-del"><i class="fa fa-trash"></i></button>',
				'</td></tr>',
			].join('');
		}).join('');
		$tbody.html(rows);
		$('.rq-question-count').text(state.questions.length);
		updateStatusPanel();
	}

	function loadQuestions() {
		return apiFetch('GET', API_BASE + '/questions').then(function (resp) {
			var data = unwrap(resp);
			var list = [];
			if (Array.isArray(data)) {
				list = data;
			} else if (data && Array.isArray(data.questions)) {
				list = data.questions;
			} else if (data && typeof data === 'object') {
				list = [];
			}
			state.questions = list || [];
			renderQuestionsTable();
		}).catch(function (err) {
			alerts.error('[[rulesquiz:admin.error.load_questions]]: ' + (err && err.message ? err.message : err));
		});
	}

	function blankOption(idx) {
		var letter = String.fromCharCode(97 + idx); // a,b,c,...
		return { id: letter, text: '', correct: false };
	}

	function renderOptions(type, options) {
		var $box = $('#rq-q-options');
		$box.empty();
		var $addBtn = $('#rq-q-add-option');
		var $optsBlock = $('.rq-options-block');
		var $ftBlock = $('.rq-freetext-block');

		if (type === 'freetext') {
			$optsBlock.addClass('d-none hidden');
			$ftBlock.removeClass('d-none hidden');
			return;
		}
		$optsBlock.removeClass('d-none hidden');
		$ftBlock.addClass('d-none hidden');

		var opts = Array.isArray(options) ? options.slice() : [];

		if (type === 'truefalse') {
			$addBtn.hide();
			var byId = {};
			opts.forEach(function (o) { byId[o.id] = o; });
			opts = [
				{ id: 'true',  text: 'True',  correct: !!(byId['true'] && byId['true'].correct) },
				{ id: 'false', text: 'False', correct: !!(byId['false'] && byId['false'].correct) },
			];
		} else {
			$addBtn.show();
			if (!opts.length) {
				opts = [blankOption(0), blankOption(1)];
			}
		}

		var inputType = (type === 'multi') ? 'checkbox' : 'radio';
		opts.forEach(function (opt, idx) {
			var lockedText = (type === 'truefalse');
			var row = $(
				'<div class="rq-opt-row" data-idx="' + idx + '">' +
					'<input type="text" class="form-control rq-opt-id" placeholder="id" value="' + escapeHtml(opt.id || '') + '"' + (lockedText ? ' readonly' : '') + '>' +
					'<input type="text" class="form-control rq-opt-text" placeholder="Text" value="' + escapeHtml(opt.text || '') + '"' + (lockedText ? ' readonly' : '') + '>' +
					'<label class="rq-opt-correct">' +
						'<input type="' + inputType + '" name="rq-opt-correct" class="rq-opt-correct-input"' + (opt.correct ? ' checked' : '') + '> ' +
						'[[rulesquiz:admin.q.correct]]' +
					'</label>' +
					(lockedText ? '' : '<button type="button" class="btn btn-xs btn-sm btn-danger rq-opt-del"><i class="fa fa-times"></i></button>') +
				'</div>'
			);
			$box.append(row);
		});
		translator.translate($box.html(), function (t) { $box.html(t); rebindOptionEvents(); });
	}

	function rebindOptionEvents() {
		$('#rq-q-options').off('click', '.rq-opt-del').on('click', '.rq-opt-del', function () {
			$(this).closest('.rq-opt-row').remove();
		});
	}

	function collectOptionsFromForm(type) {
		var rows = $('#rq-q-options .rq-opt-row');
		var opts = [];
		rows.each(function () {
			var $r = $(this);
			opts.push({
				id: $r.find('.rq-opt-id').val() || '',
				text: $r.find('.rq-opt-text').val() || '',
				correct: $r.find('.rq-opt-correct-input').is(':checked'),
			});
		});
		if (type === 'truefalse') {
			// enforce shape
			var byId = {};
			opts.forEach(function (o) { byId[o.id] = o; });
			return [
				{ id: 'true',  text: 'True',  correct: !!(byId['true'] && byId['true'].correct) },
				{ id: 'false', text: 'False', correct: !!(byId['false'] && byId['false'].correct) },
			];
		}
		return opts;
	}

	function openQuestionModal(q) {
		state.editingQid = q ? q.qid : null;
		$('#rq-q-qid').val(q ? q.qid : '');
		$('#rq-q-type').val((q && q.type) || 'single');
		$('#rq-q-title').val((q && q.title) || '');
		$('#rq-q-body').val((q && q.bodyMarkdown) || '');
		$('#rq-q-image').val((q && q.imageUrl) || '');
		$('#rq-q-rulelink').val((q && q.ruleLinkUrl) || '');
		$('#rq-q-answertext').val((q && q.answerText) || '');
		$('#rq-q-answerregex').val((q && q.answerRegex) || '');
		$('#rq-q-explanation').val((q && q.explanationMarkdown) || '');
		$('#rq-q-weight').val((q && q.weight != null) ? q.weight : 1);
		$('#rq-q-tags').val(q && q.tags ? toCsv(q.tags) : '');
		$('#rq-q-sort').val((q && q.sort != null) ? q.sort : 100);
		renderOptions(((q && q.type) || 'single'), q ? q.options : null);

		var $m = $('#rq-question-modal');
		// Bootstrap 5 vs 4: try BS5 modal first
		if (window.bootstrap && window.bootstrap.Modal) {
			var bs = window.bootstrap.Modal.getOrCreateInstance($m[0]);
			bs.show();
		} else if (typeof $m.modal === 'function') {
			$m.modal('show');
		} else {
			$m.addClass('show').css('display', 'block');
		}
	}

	function closeQuestionModal() {
		var $m = $('#rq-question-modal');
		if (window.bootstrap && window.bootstrap.Modal) {
			var bs = window.bootstrap.Modal.getOrCreateInstance($m[0]);
			bs.hide();
		} else if (typeof $m.modal === 'function') {
			$m.modal('hide');
		} else {
			$m.removeClass('show').css('display', 'none');
		}
	}

	function saveQuestionFromModal() {
		var type = $('#rq-q-type').val();
		var payload = {
			type: type,
			title: $('#rq-q-title').val(),
			bodyMarkdown: $('#rq-q-body').val(),
			imageUrl: $('#rq-q-image').val(),
			ruleLinkUrl: $('#rq-q-rulelink').val(),
			options: (type === 'freetext') ? [] : collectOptionsFromForm(type),
			answerText: (type === 'freetext') ? $('#rq-q-answertext').val() : '',
			answerRegex: (type === 'freetext') ? $('#rq-q-answerregex').val() : '',
			explanationMarkdown: $('#rq-q-explanation').val(),
			weight: Number($('#rq-q-weight').val()) || 1,
			tags: fromCsv($('#rq-q-tags').val()),
			sort: Number($('#rq-q-sort').val()) || 100,
		};
		var qid = state.editingQid;
		console.log('[rules-quiz/acp] ' + (qid ? 'PUT' : 'POST') + ' question', payload, 'qid=', qid);

		var $btn = $('#rq-q-save');
		var origHtml = $btn.html();
		$btn.prop('disabled', true);
		$btn.html('<i class="fa fa-spinner fa-spin"></i> [[rulesquiz:admin.saving]]');
		translator.translate($btn.html(), function (t) { $btn.html(t); });

		var req = qid
			? apiFetch('PUT', API_BASE + '/questions/' + encodeURIComponent(qid), payload)
			: apiFetch('POST', API_BASE + '/questions', payload);
		return req.then(function (res) {
			console.log('[rules-quiz/acp] question save response', res);
			alerts.success('[[rulesquiz:admin.saved]]');
			closeQuestionModal();
			return loadQuestions();
		}).catch(function (err) {
			console.error('[rules-quiz/acp] question save failed', err);
			var msg = err && err.message ? err.message : String(err);
			alerts.error('[[rulesquiz:admin.error.save_question]]: ' + msg);
		}).then(function () {
			$btn.prop('disabled', false);
			$btn.html(origHtml);
		});
	}

	function deleteQuestion(qid) {
		if (!window.confirm('[[rulesquiz:admin.confirm_delete]]')) { return; }
		console.log('[rules-quiz/acp] DELETE question', qid);
		apiFetch('DELETE', API_BASE + '/questions/' + encodeURIComponent(qid)).then(function (res) {
			console.log('[rules-quiz/acp] DELETE response', res);
			alerts.success('[[rulesquiz:admin.deleted]]');
			return loadQuestions();
		}).catch(function (err) {
			console.error('[rules-quiz/acp] DELETE failed', err);
			var msg = err && err.message ? err.message : String(err);
			alerts.error('[[rulesquiz:admin.error.delete_question]]: ' + msg);
		});
	}

	function openImportModal() {
		var $m = $('#rq-import-modal');
		if (window.bootstrap && window.bootstrap.Modal) {
			window.bootstrap.Modal.getOrCreateInstance($m[0]).show();
		} else if (typeof $m.modal === 'function') {
			$m.modal('show');
		}
	}

	function closeImportModal() {
		var $m = $('#rq-import-modal');
		if (window.bootstrap && window.bootstrap.Modal) {
			window.bootstrap.Modal.getOrCreateInstance($m[0]).hide();
		} else if (typeof $m.modal === 'function') {
			$m.modal('hide');
		}
	}

	function runImport() {
		var fmt = $('#rq-import-format').val();
		var fileInput = document.getElementById('rq-import-file');
		var file = fileInput && fileInput.files && fileInput.files[0];
		if (!file) {
			alerts.error('[[rulesquiz:admin.error.no_file]]');
			return;
		}

		if (fmt === 'json') {
			var fr = new FileReader();
			fr.onload = function () {
				var parsed;
				try { parsed = JSON.parse(fr.result); } catch (e) {
					alerts.error('[[rulesquiz:admin.error.bad_json]]: ' + e.message);
					return;
				}
				console.log('[rules-quiz/acp] POST import json', { count: Array.isArray(parsed) ? parsed.length : 'n/a' });
				apiFetch('POST', API_BASE + '/questions/import?format=json', { questions: parsed }).then(function (resp) {
					console.log('[rules-quiz/acp] import response', resp);
					var body = unwrap(resp) || {};
					var added = body.added || 0;
					alerts.success('[[rulesquiz:admin.imported]] (' + added + ')');
					closeImportModal();
					return loadQuestions();
				}).catch(function (err) {
					console.error('[rules-quiz/acp] import failed', err);
					var msg = err && err.message ? err.message : String(err);
					alerts.error('[[rulesquiz:admin.error.import]]: ' + msg);
				});
			};
			fr.readAsText(file);
		} else {
			var fd = new FormData();
			fd.append('file', file);
			console.log('[rules-quiz/acp] POST import csv', file.name);
			apiFetch('POST', API_BASE + '/questions/import?format=csv', fd).then(function (resp) {
				console.log('[rules-quiz/acp] import response', resp);
				var body = unwrap(resp) || {};
				var added = body.added || 0;
				alerts.success('[[rulesquiz:admin.imported]] (' + added + ')');
				closeImportModal();
				return loadQuestions();
			}).catch(function (err) {
				console.error('[rules-quiz/acp] import failed', err);
				var msg = err && err.message ? err.message : String(err);
				alerts.error('[[rulesquiz:admin.error.import]]: ' + msg);
			});
		}
	}

	// ---------------------------------------------------------------
	// reports tab
	// ---------------------------------------------------------------

	function renderHardest(list) {
		var $ul = $('#rq-hardest-list');
		if (!list || !list.length) {
			$ul.html('<li class="list-group-item text-muted">[[rulesquiz:admin.empty_hardest]]</li>');
			translator.translate($ul.html(), function (t) { $ul.html(t); });
			return;
		}
		var html = list.map(function (item) {
			var qid = item.qid;
			var fails = item.fails || 0;
			var match = state.questions.find(function (q) { return String(q.qid) === String(qid); });
			var title = match ? match.title : ('#' + qid);
			return '<li class="list-group-item d-flex justify-content-between">' +
				'<span>' + escapeHtml(title) + '</span>' +
				'<span class="badge bg-danger badge-danger">' + escapeHtml(fails) + '</span>' +
				'</li>';
		}).join('');
		$ul.html(html);
	}

	function renderDailyChart(daily) {
		daily = daily || [];
		var canvas = document.getElementById('rulesquiz-daily-chart');
		var $fallback = $('#rq-daily-fallback');

		function tableFallback() {
			canvas.style.display = 'none';
			var rows = daily.map(function (d) {
				return '<tr><td>' + escapeHtml(d.date) + '</td><td class="text-success">' + escapeHtml(d.passed || 0) + '</td><td class="text-danger">' + escapeHtml(d.failed || 0) + '</td></tr>';
			}).join('');
			$fallback.removeClass('d-none hidden').html(
				'<table class="table table-sm"><thead><tr><th>Date</th><th>Passed</th><th>Failed</th></tr></thead><tbody>' + rows + '</tbody></table>'
			);
		}

		if (typeof require === 'function') {
			try {
				require(['chart.js'], function (ChartLib) {
					try {
						var ChartCtor = (ChartLib && ChartLib.Chart) || ChartLib || window.Chart;
						if (!ChartCtor) { return tableFallback(); }
						var labels = daily.map(function (d) { return d.date; });
						var passedData = daily.map(function (d) { return d.passed || 0; });
						var failedData = daily.map(function (d) { return d.failed || 0; });
						if (canvas._rqChart) { canvas._rqChart.destroy(); }
						canvas._rqChart = new ChartCtor(canvas.getContext('2d'), {
							type: 'bar',
							data: {
								labels: labels,
								datasets: [
									{ label: 'Passed', data: passedData, backgroundColor: 'rgba(40,167,69,0.7)' },
									{ label: 'Failed', data: failedData, backgroundColor: 'rgba(220,53,69,0.7)' },
								],
							},
							options: { responsive: true, scales: { y: { beginAtZero: true } } },
						});
					} catch (e) { tableFallback(); }
				}, function () { tableFallback(); });
			} catch (e) { tableFallback(); }
		} else if (window.Chart) {
			renderDailyChart(daily); // unreachable normally
		} else {
			tableFallback();
		}
	}

	function loadStats() {
		var to = new Date();
		var from = new Date(Date.now() - 30 * 24 * 3600 * 1000);
		var qs = '?from=' + encodeURIComponent(from.toISOString()) + '&to=' + encodeURIComponent(to.toISOString());
		return apiFetch('GET', API_BASE + '/stats' + qs).then(function (resp) {
			var data = unwrap(resp) || {};
			var totals = data.totals || { passed: 0, failed: 0 };
			$('#rq-stat-passed').text(totals.passed || 0);
			$('#rq-stat-failed').text(totals.failed || 0);
			renderHardest(data.hardestQuestions || []);
			renderDailyChart(data.daily || []);
		}).catch(function (err) {
			alerts.error('[[rulesquiz:admin.error.load_stats]]: ' + (err && err.message ? err.message : err));
		});
	}

	function lookupUserAttempts() {
		var uid = $('#rq-lookup-uid').val();
		if (!uid) {
			alerts.error('[[rulesquiz:admin.error.no_uid]]');
			return;
		}
		apiFetch('GET', API_BASE + '/users/' + encodeURIComponent(uid) + '/attempts').then(function (resp) {
			var data = unwrap(resp) || {};
			var attempts = data.attempts || data || [];
			if (!Array.isArray(attempts)) { attempts = []; }
			var $tb = $('#rq-attempts-tbody');
			if (!attempts.length) {
				$tb.html('<tr><td colspan="5" class="text-center text-muted">[[rulesquiz:admin.no_attempts]]</td></tr>');
				translator.translate($tb.html(), function (t) { $tb.html(t); });
				return;
			}
			$tb.html(attempts.map(function (a) {
				var started = a.startedAt ? new Date(a.startedAt).toLocaleString() : '';
				var finished = a.finishedAt ? new Date(a.finishedAt).toLocaleString() : '';
				var passClass = a.passed ? 'text-success' : 'text-danger';
				var passText = a.passed ? '[[rulesquiz:pass]]' : '[[rulesquiz:fail]]';
				return '<tr>' +
					'<td>' + escapeHtml(a.aid) + '</td>' +
					'<td>' + escapeHtml(started) + '</td>' +
					'<td>' + escapeHtml(finished) + '</td>' +
					'<td>' + escapeHtml(a.score) + ' / ' + escapeHtml(a.total) + '</td>' +
					'<td class="' + passClass + '">' + passText + '</td>' +
					'</tr>';
			}).join(''));
			translator.translate($tb.html(), function (t) { $tb.html(t); });
		}).catch(function (err) {
			alerts.error('[[rulesquiz:admin.error.load_attempts]]: ' + (err && err.message ? err.message : err));
		});
	}

	// ---------------------------------------------------------------
	// init
	// ---------------------------------------------------------------

	function bindEvents() {
		// settings save
		$(document).off('click.rqsave').on('click.rqsave', '#rq-save-settings', function () {
			saveSettings();
		});
		$(document).off('click.rqtestsave').on('click.rqtestsave', '#rq-test-save', function () {
			testSaveRoundtrip();
		});

		// questions
		$(document).off('click.rqaddq').on('click.rqaddq', '#rq-add-question', function () {
			openQuestionModal(null);
		});
		$(document).off('click.rqimport').on('click.rqimport', '#rq-import-question', function () {
			openImportModal();
		});
		$(document).off('click.rqimportgo').on('click.rqimportgo', '#rq-import-go', function () {
			runImport();
		});
		$(document).off('click.rqedit').on('click.rqedit', '.rq-q-edit', function () {
			var qid = $(this).closest('tr').attr('data-qid');
			var q = state.questions.find(function (x) { return String(x.qid) === String(qid); });
			if (q) { openQuestionModal(q); }
		});
		$(document).off('click.rqdel').on('click.rqdel', '.rq-q-del', function () {
			var qid = $(this).closest('tr').attr('data-qid');
			deleteQuestion(qid);
		});
		$(document).off('click.rqqsave').on('click.rqqsave', '#rq-q-save', function () {
			saveQuestionFromModal();
		});
		$(document).off('change.rqqtype').on('change.rqqtype', '#rq-q-type', function () {
			renderOptions($(this).val(), null);
		});
		$(document).off('click.rqaddopt').on('click.rqaddopt', '#rq-q-add-option', function () {
			var idx = $('#rq-q-options .rq-opt-row').length;
			var current = collectOptionsFromForm($('#rq-q-type').val());
			current.push(blankOption(idx));
			renderOptions($('#rq-q-type').val(), current);
		});

		// reports
		$(document).off('click.rqlookup').on('click.rqlookup', '#rq-lookup-btn', function () {
			lookupUserAttempts();
		});

		// reports tab activation -> lazy load
		$(document).off('shown.bs.tab.rqreports show.bs.tab.rqreports').on('shown.bs.tab show.bs.tab', 'a[href="#rq-tab-reports"]', function () {
			loadStats();
		});
		$(document).off('shown.bs.tab.rqquestions show.bs.tab.rqquestions').on('shown.bs.tab show.bs.tab', 'a[href="#rq-tab-questions"]', function () {
			if (!state.questions.length) { loadQuestions(); }
		});
	}

	ACP.init = function () {
		bindEvents();
		loadSettings();
		loadQuestions();
		// stats on demand when reports tab is shown
	};

	return ACP;
});
