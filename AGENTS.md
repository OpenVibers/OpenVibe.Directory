# AGENTS.md — OpenVibe.Directory

## Project overview

Source-linked directories for the OpenVibe network: OpenVibe sites, tools, AI models and providers,
open-source projects, local businesses from OpenStreetMap, and opt-in people listings. Every entry
carries a source and a last-checked date. Node.js/Express, server-rendered pages, one small
PostgreSQL table for people listings.

- Origin `https://openvibe.directory`, port `5281`, unit `openvibe-directory.service`,
  release root `/opt/openvibe.directory`.
- Public sources refresh at startup and every six hours; a failed source keeps its last successful
  in-memory snapshot and the failure is visible in `/api/v1/kinds`.

## What it owns

- `GET /`, `/kinds/:kind`, `/search`, `/entries/:kind/:slug` — HTML, with `Accept: text/markdown` on
  entry pages.
- `GET /api/v1/kinds`, `/api/v1/entries`, `/api/v1/entries/:kind/:slug` — the public read API.
- `/api/v1/people/me` and `/people/me` — a signed-in person's own listing (get, put, delete).
- `robots.txt`, `sitemap.xml`, `llms.txt`, JSON-LD, `/release.json`, `/shared/*`, `/api/health`,
  `/api/ready`.
- The `directory_people` table and its validation.

It does not own the sources: it reads Network's frame, Tools, Exchange models, GitHub's public search
and OpenStreetMap. It does not publish anything outside this site.

## Where the data comes from

[server/sources.js](server/sources.js) `URLS`/`kinds`:

- `https://openvibe.network/api/frame?host=openvibe.network` — OpenVibe sites.
- `https://openvibe.tools/api/v1/tools` — tools.
- `https://openvibe.exchange/api/v1/models` — AI models and providers.
- `https://api.github.com/search/repositories?q=org%3AOpenVibers+archived%3Afalse` — projects.
- `https://api.openstreetmap.org/api/0.6/map?bbox=…` — a **bounded San Francisco pilot** under
  ODbL 1.0.
- People come from PostgreSQL, not a feed.

Every entry is normalised (`entry()`, `slug()`, `safeUrl()`): a missing id/name/source or a non-https
source is dropped rather than guessed.

## Repository map

- **Entry:** [server/index.js](server/index.js) — builds the source store, opens the people store when
  `DATABASE_URL` is set, listens on `PORT || 5281`.
- **App/routes:** [server/app.js](server/app.js) — security headers, static `/public`, `/shared`,
  `/auth`, health/ready, release, the v1 API, pages, people form, 404.
- **Sources:** [server/sources.js](server/sources.js) — fetch/refresh, normalisation, search.
- **People:** [server/people.js](server/people.js) — `createPeopleStore` (migration + CRUD), `validate`,
  `publicEntry`, `writeGuard`, `createAuth`.
- **Views:** [server/views.js](server/views.js) — HTML/markdown, escaping, JSON-LD.
- **Browser:** [public/people.js](public/people.js).
- **Schema:** [migrations/0001_people.sql](migrations/0001_people.sql).
- **Deploy:** [deploy/systemd/openvibe-directory.service](deploy/systemd/openvibe-directory.service),
  [deploy/nginx/openvibe.directory.conf](deploy/nginx/openvibe.directory.conf).

## Commands

```bash
npm ci
node server/index.js      # http://127.0.0.1:5281; start script is `npm start`
npm test                  # node --test test/*.test.js
ov test                   # the harness's sharded run of what the change reaches
node --check <file.js>
```

There is no `dev` script and no build step. Without `DATABASE_URL` the directories still serve from
the feeds; the people routes answer `503 people.unavailable`.

## Database and migrations

One table, `directory_people`, created from [migrations/0001_people.sql](migrations/0001_people.sql)
**at startup** by [server/people.js](server/people.js), not by a boot migration runner: the file is
read and applied through the **owner** connection (`DATABASE_DIRECT_URL`), while reads and writes use
the runtime connection (`DATABASE_URL`). The statement is `CREATE TABLE IF NOT EXISTS`, so startup is
idempotent. Keep that split: the test asserts exactly one owner call (the DDL) and then a runtime
`SELECT`. Listing text is capped at 500 characters, names at 100, websites must be `https:` with no
credentials, and `visible` defaults to **false**.

## Auth and the people listing

- Sign-in is OpenVibe.Network SSO via `openvibe-sdk/sso` ([server/people.js](server/people.js)
  `createAuth`); without `OV_OAUTH_CLIENT_ID`/`SECRET` the auth object is absent and the people routes
  are disabled.
- Only the person's own row: the subject comes from the session (`usr_…`); never take an id from the
  query or body.
- `writeGuard` requires the same-origin `Origin` (or no Origin plus a Bearer token) and
  `application/json` (DELETE excepted); invalid requests answer 403/415.
- An entry is private until the person explicitly publishes it (`visible: true`).

## Frontend loading model

Server-rendered HTML from [server/views.js](server/views.js) with `openvibe-shared/kit`,
`/thread`, `/shell` and `/serve`; **no SPA, no bundler**. Static files come from `public/`;
`/shared/*` is served from the pinned `openvibe-shared` node_modules by `openvibe-shared/serve`.
The only page script is [public/people.js](public/people.js). The home page redirects a signed-out
browser to silent SSO unless `?sso=none` or the guest hint cookie is set — keep that for crawlers
(`bot|crawl|spider|slurp` must not be redirected).

## Deploy

Unit [deploy/systemd/openvibe-directory.service](deploy/systemd/openvibe-directory.service) runs
`/opt/openvibe.directory/server/index.js` on `127.0.0.1:5281`, env `/etc/openvibe/directory.env`;
vhost [deploy/nginx/openvibe.directory.conf](deploy/nginx/openvibe.directory.conf). The repository does
not document an `ovhost deploy` command — change the unit/vhost with the host's own installer rather
than inventing one. No secret belongs in a file or a log.

## Tests

`npm test` runs Node's built-in runner over [test/directory.test.js](test/directory.test.js) and
[test/people.test.js](test/people.test.js). They pin: OSM phone-tag omission and no age/city/phone
fields; unlisted by default; the owner-connection DDL / runtime-read split; entry validation; the
public pages, markdown negotiation, sitemap and llms output. `ov test` runs the same suite.

## Conventions

- CommonJS; **compact single-line JS** is the style in `server/app.js`, `server/sources.js` and
  `server/people.js`; the newer view helpers use 4 spaces. Match the file you edit.
- Escape every interpolated value (`views.esc`); embed JSON with the `<`-escaping `json()`.
- Errors are small JSON bodies (`{ error: 'entry.not_found' }`) or problem-style statuses; do not leak
  upstream text.
- Source URLs are `https:` only; never invent a source, a checked date or a phone number.

## Pitfalls

- **Unverified OSM phone tags are omitted.** A business number needs a business-owned source before
  publication; do not re-add phone fields.
- **No private-person searches or reverse lookups.** People listings are claim/edit/unpublish/delete
  of one's own row only.
- **The SF business pilot is bounded and ODbL 1.0.** Do not widen the bounding box or change the
  licence without the owner.
- **A failed source keeps its last snapshot** and reports the failure; it never empties the directory
  or silently serves stale data as fresh.
- **The startup migration uses the owner connection**; using `DATABASE_URL` for DDL will fail in
  production and breaks the test.
- **`visible` defaults false.** Publishing is an explicit act by the person.
- **Crawler behavior:** home may redirect signed-out browsers to silent SSO; bots must not be
  redirected and must still see the page.

## Documentation

- [README.md](README.md) — the product brief, sources, licence and the database split.
- [migrations/0001_people.sql](migrations/0001_people.sql) — the only table.
- OpenVibe.Contracts, if a directory manifest is added, is the place for the public schema.
