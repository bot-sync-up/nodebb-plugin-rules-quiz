'use strict';

/**
 * Minimal, safe markdown → HTML converter used to pre-render the rules text,
 * intro text, question bodies, and answer explanations before they reach the
 * browser.
 *
 * We deliberately do NOT pull in a heavy MD parser (marked / markdown-it) —
 * plugin bundles in NodeBB need to stay small. This covers the subset that
 * forum admins actually use: headings, bold/italic, links, lists, inline code.
 *
 * Everything is HTML-escaped first, so even if the admin pastes tags they
 * show up as text, not active markup. The only tags we emit are the ones we
 * construct here.
 */

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

function renderInline(text) {
  let out = escapeHtml(text);
  // bold **x** before italic *x* to avoid clash
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  out = out.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');
  out = out.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  // links [text](url) — url already escaped above
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, url) => {
    const safeUrl = /^(https?:\/\/|\/|#)/i.test(url) ? url : '#';
    return '<a href="' + safeUrl + '" target="_blank" rel="noopener">' + txt + '</a>';
  });
  return out;
}

/**
 * @param {string} src Markdown source.
 * @returns {string} Safe HTML.
 */
function render(src) {
  if (!src || typeof src !== 'string') return '';
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let inList = null; // 'ul' | 'ol' | null
  let para = [];

  function flushPara() {
    if (para.length) {
      out.push('<p>' + renderInline(para.join(' ')) + '</p>');
      para = [];
    }
  }
  function closeList() {
    if (inList) {
      out.push('</' + inList + '>');
      inList = null;
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushPara(); closeList(); continue; }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara(); closeList();
      const level = h[1].length;
      out.push('<h' + level + '>' + renderInline(h[2]) + '</h' + level + '>');
      continue;
    }

    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      const want = ul ? 'ul' : 'ol';
      if (inList !== want) { closeList(); out.push('<' + want + '>'); inList = want; }
      out.push('<li>' + renderInline((ul || ol)[1]) + '</li>');
      continue;
    }

    closeList();
    para.push(line);
  }
  flushPara();
  closeList();
  return out.join('\n');
}

module.exports = { render, escapeHtml };
