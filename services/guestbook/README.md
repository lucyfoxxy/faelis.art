# Faelis Guestbook service

Tiny same-origin guestbook API for the static Astro site. Public entries are stored in SQLite and become visible only after approval through a one-time moderation link sent by mail. Private messages and contact details are never returned by the public API.

## Setup

1. `cp services/guestbook/.env.example services/guestbook/.env` and fill in the secret/mail settings.
2. Run `npm install` at repository root.
3. For a local smoke test use `GUESTBOOK_MAIL_MODE=log` in the service `.env` and run `npm run -w services/guestbook dev`.
4. Production can use `config/systemd/faelis-guestbook.service`; Apache proxies `/api/guestbook` to `127.0.0.1:8787`.

The database schema is created automatically on first start. Keep `/srv/faelis.art/data/guestbook.sqlite` outside the deploy/public trees.
