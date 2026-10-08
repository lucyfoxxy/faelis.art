import { fetchGuestbook, renderEntry } from './guestbook.js';

export default async function initGuestbookLatest() {
  const section = document.querySelector('[data-guestbook-latest]');
  const list = section?.querySelector('[data-guestbook-latest-entries]');
  if (!section || !list) return;

  try {
    const entries = await fetchGuestbook(3);
    if (!entries.length) return;
    list.replaceChildren(...entries.map((entry) => renderEntry(entry, { compact: true })));
    section.hidden = false;
  } catch {
    // Latest entries are an enhancement; keep the entire section invisible on failure.
  }
}
