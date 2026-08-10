/* ==========================================================================
   Buildario — small DOM and formatting helpers shared by the app pages.
   No framework, same as the rest of the site.
   ========================================================================== */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Every value that reaches innerHTML goes through here first. Names, company
    names and message bodies are user-authored, and one unescaped `<` is all an
    injected script needs. */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Markup that has already been escaped. Carrying the distinction in a type is
    what lets html`` nest inside html`` without double-escaping the inner
    result — a plain string cannot say whether it is content or markup. */
class SafeMarkup {
  constructor(value) { this.value = String(value); }
  toString() { return this.value; }
}

/** Marks a string as already-safe markup so html`` leaves it alone. */
export function raw(markup) {
  return new SafeMarkup(markup);
}

/** Escaped by default. Use as html`<p>${untrusted}</p>`; interpolate another
    html`` result, or an array of them, to compose. */
export function html(strings, ...values) {
  return raw(strings.reduce((out, chunk, i) => {
    const value = values[i - 1];
    const rendered = value instanceof SafeMarkup
      ? value.value
      : Array.isArray(value)
        ? value.map((item) => (item instanceof SafeMarkup ? item.value : esc(item))).join('')
        : esc(value);
    return out + rendered + chunk;
  }));
}

export function fmtDate(value) {
  if (!value) return '—';

  // A bare `2026-08-09` from a date column is parsed as UTC midnight, which
  // renders as the day before anywhere west of Greenwich. Rebuild it in local
  // time; timestamps keep their normal parsing.
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
    : new Date(value);

  return date.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

export function fmtDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

export function relTime(value) {
  if (!value) return '';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  const steps = [
    [60, 'second', 1],
    [3600, 'minute', 60],
    [86400, 'hour', 3600],
    [604800, 'day', 86400],
    [2629800, 'week', 604800],
    [31557600, 'month', 2629800]
  ];
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [limit, unit, divisor] of steps) {
    if (Math.abs(seconds) < limit) return formatter.format(-Math.round(seconds / divisor), unit);
  }
  return formatter.format(-Math.round(seconds / 31557600), 'year');
}

export function money(cents, currency = 'USD') {
  if (cents === null || cents === undefined) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency', currency, maximumFractionDigits: 0
  }).format(cents / 100);
}

export function fileSize(bytes) {
  if (!bytes && bytes !== 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

export const LEAD_STATUS = {
  new: 'New', contacted: 'Contacted', qualified: 'Qualified', won: 'Won', lost: 'Lost'
};

export const PROJECT_STATUS = {
  discovery: 'Discovery', design: 'Design', build: 'Build',
  review: 'Review', launched: 'Launched', archived: 'Archived'
};

/* ---------------------------------------------------------------------------
   Feedback
   --------------------------------------------------------------------------- */

let toastHost = null;

export function toast(message, kind = 'info') {
  if (!toastHost) {
    toastHost = document.createElement('div');
    toastHost.className = 'toast-host';
    // polite, not assertive: these confirm an action the user just took
    toastHost.setAttribute('role', 'status');
    toastHost.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastHost);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = message;
  toastHost.appendChild(el);
  setTimeout(() => el.classList.add('out'), 4000);
  setTimeout(() => el.remove(), 4600);
}

/** Disables a submit button for the length of an async action so a double
    click cannot send the same form twice. */
export function pending(button, isPending, busyLabel = 'Working…') {
  if (!button) return;
  if (isPending) {
    button.dataset.label = button.dataset.label || button.textContent;
    button.disabled = true;
    button.textContent = busyLabel;
  } else {
    button.disabled = false;
    if (button.dataset.label) button.textContent = button.dataset.label;
  }
}

export function setMessage(el, text, kind = 'error') {
  if (!el) return;
  el.textContent = text || '';
  el.className = `form-msg form-msg-${kind}`;
  el.hidden = !text;
}
