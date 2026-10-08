const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  year: 'numeric', month: 'short', day: 'numeric',
});

export default function initGuestbook() {
  const form = document.querySelector('[data-guestbook-form]');
  const list = document.querySelector('[data-guestbook-entries]');
  const status = document.querySelector('[data-guestbook-status]');
  const startedAt = document.querySelector('[data-guestbook-started-at]');

  if (startedAt) startedAt.value = String(Date.now());
  if (list) loadEntries(list);

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(form).entries());

    setStatus(status, 'Sending…', false);
    if (button) button.disabled = true;

    try {
      const response = await fetch('/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || friendlyError(payload.error));

      form.reset();
      if (startedAt) startedAt.value = String(Date.now());
      setStatus(status, 'Thank you! Your entry is waiting for approval. 💜', false);
    } catch (error) {
      setStatus(status, error?.message || 'Could not send your entry. Please try again.', true);
    } finally {
      if (button) button.disabled = false;
    }
  });
}

export async function fetchGuestbook(limit = 30) {
  const response = await fetch(`/api/guestbook?limit=${encodeURIComponent(limit)}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!response.ok) throw new Error('Guestbook is unavailable right now.');
  const payload = await response.json();
  return Array.isArray(payload.entries) ? payload.entries : [];
}

export function renderEntry(entry, { compact = false } = {}) {
  const article = document.createElement('article');
  article.className = `guestbook-entry${compact ? ' guestbook-entry--compact' : ''}`;

  const header = document.createElement('header');
  header.className = 'guestbook-entry__head';

  const name = entry.website ? document.createElement('a') : document.createElement('strong');
  name.className = 'guestbook-entry__name';
  name.textContent = entry.name;
  if (entry.website) {
    name.href = entry.website;
    name.target = '_blank';
    name.rel = 'noopener noreferrer nofollow ugc';
  }

  const time = document.createElement('time');
  time.className = 'guestbook-entry__date';
  time.dateTime = entry.approvedAt;
  time.textContent = formatDate(entry.approvedAt);

  const message = document.createElement('p');
  message.className = 'guestbook-entry__message';
  message.textContent = entry.message;

  header.append(name, time);
  article.append(header, message);
  return article;
}

async function loadEntries(list) {
  try {
    const entries = await fetchGuestbook(50);
    list.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'guestbook__empty';
      empty.textContent = 'No entries yet. Be the first to leave a pawprint!';
      list.append(empty);
      return;
    }
    list.append(...entries.map((entry) => renderEntry(entry)));
  } catch (error) {
    const msg = document.createElement('p');
    msg.className = 'guestbook__empty';
    msg.textContent = error?.message || 'Guestbook is unavailable right now.';
    list.replaceChildren(msg);
  }
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date);
}
function setStatus(node, message, error) {
  if (!node) return;
  node.textContent = message;
  node.dataset.error = error ? 'true' : 'false';
}
function friendlyError(code) {
  if (code === 'rate_limited') return 'Too many entries. Please try again later.';
  if (code === 'too_fast') return 'Please take a moment before submitting.';
  if (code === 'website_invalid') return 'Please enter a valid website address.';
  return 'Could not send your entry. Please check the fields and try again.';
}
