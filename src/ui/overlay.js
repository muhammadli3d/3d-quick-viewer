/**
 * Loading overlay (filename + stage + progress bar) and toast messages.
 * Errors always go through here so they're visible in the UI, not just the console.
 */
const $ = (id) => document.getElementById(id);

export const loading = {
  show(name) {
    $('loading-name').textContent = name;
    this.stage('Reading file…');
    this.progress(null);
    $('loading-overlay').hidden = false;
  },

  stage(text) {
    $('loading-stage').textContent = text;
  },

  /** @param {number|null} fraction 0..1, or null for an indeterminate bar */
  progress(fraction) {
    const bar = $('loading-bar');
    if (fraction == null || !Number.isFinite(fraction)) {
      bar.classList.add('indeterminate');
      bar.style.width = '';
    } else {
      bar.classList.remove('indeterminate');
      bar.style.width = `${Math.round(Math.min(Math.max(fraction, 0), 1) * 100)}%`;
    }
  },

  hide() {
    $('loading-overlay').hidden = true;
  },
};

/**
 * Show a toast. Errors stay until dismissed; info/warnings fade after a while.
 * @param {'info'|'warn'|'error'} kind
 */
export function toast(kind, title, body = '', { timeout } = {}) {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');

  const content = document.createElement('div');
  content.className = 'toast-body';
  const t = document.createElement('div');
  t.className = 'toast-title';
  t.textContent = title;
  content.append(t);
  if (body) content.append(document.createTextNode(body));

  const close = document.createElement('button');
  close.textContent = '×';
  close.title = 'Dismiss';
  close.addEventListener('click', () => el.remove());

  el.append(content, close);
  $('toasts').append(el);

  const ms = timeout ?? (kind === 'error' ? 0 : kind === 'warn' ? 9000 : 5000);
  if (ms > 0) setTimeout(() => el.remove(), ms);
  return el;
}

export function clearToasts() {
  $('toasts').replaceChildren();
}
