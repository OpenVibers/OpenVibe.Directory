'use strict';
// OpenVibe.Directory's pages (remade 2026-11-14; the owner: "completely terrible design … doesn't use openvibe.design …
// needs to be remade"). One look with the network's: a real search field, each directory a tile on its own hue with its
// count, the directories as places (a side column on a computer, fixed tabs on a phone: kit-layout .ov-places), every
// listing a card with its glyph, its words, its kind and when it was last checked (in the reader's own clock), and an
// entry page that leads with what it is and lists where every fact came from.
const kit = require('openvibe-shared/kit');
const shell = require('openvibe-shared/shell');
const serve = require('openvibe-shared/serve');
const glyphs = require('openvibe-shared/glyphs');

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const entryPath = (e) => `/entries/${encodeURIComponent(e.kind)}/${encodeURIComponent(e.slug)}`;
/** An OpenVibe site as the menu draws it: its own app icon (openvibe-shared ov-icons), or nothing when it has none. */
const appIcon = (id) => { try { const html = require('openvibe-shared/ov-icons').appHtml(String(id || '').toLowerCase(), { size: 40 }); return /data-icon="ov"/.test(html) ? '' : html; } catch { return ''; } };
const g = (name, size = 20) => glyphs.svg(glyphs.NAMES.includes(name) ? name : 'list', { size });

/** Each directory: its glyph, its hue and one line of what is in it. */
const KIND = {
    sites: { glyph: 'globe', hue: 217, line: 'Every OpenVibe site, what it does and where it is going' },
    tools: { glyph: 'wrench', hue: 160, line: 'Free tools across OpenVibe, each with its own page' },
    models: { glyph: 'spark', hue: 280, line: 'AI models with their makers, offers and measured results' },
    providers: { glyph: 'server', hue: 32, line: 'The companies and projects that serve AI models' },
    projects: { glyph: 'code', hue: 340, line: 'OpenVibe\'s open-source projects on GitHub' },
    businesses: { glyph: 'store', hue: 190, line: 'Places from OpenStreetMap, with their published details' },
    people: { glyph: 'user', hue: 48, line: 'People who chose to be listed, and nothing they did not choose' },
};
const kindOf = (k) => KIND[k] || { glyph: 'list', hue: 217, line: '' };
const SHORT = { sites: 'Sites', tools: 'Tools', models: 'AI models', providers: 'Providers', projects: 'Projects', businesses: 'Places', people: 'People' };
/** A moment, written in UTC for crawlers and no-script; the reader's own clock replaces it (openvibe-shared time). */
const when = (iso, kind = 'day') => (iso ? `<time datetime="${esc(iso)}" data-ov-time="${kind}">${esc(String(iso).slice(0, 10))}</time>` : 'not yet');

function page(title, body, path = '/', ld = []) {
    return shell.page({
        name: 'OpenVibe.Directory', siteName: 'OpenVibe.Directory', title,
        description: 'Directories that keep themselves current: OpenVibe sites and tools, AI models and providers, open-source projects and local places, each with its sources and the day it was last checked.',
        canonical: `https://openvibe.directory${path}`, robots: 'index, follow', jsonLd: ld,
        navbar: { service: 'directory', apiBase: 'https://openvibe.network', links: [{ label: 'Directories', href: '/' }, { label: 'Your listing', href: '/people/me' }] },
        footer: { service: 'directory', variant: 'full', mount: '#ov-footer' },
        head: `<link rel="stylesheet" href="${serve.url('kit.css')}"><link rel="stylesheet" href="${serve.url('kit-layout.css')}"><link rel="stylesheet" href="${serve.url('showcase.css')}"><link rel="stylesheet" href="/directory.css">`,
        body: `<div id="navbar-mount"></div><main id="main" class="ovk-container dir">${body}</main>`,
    });
}

/** The one search: a field, its glyph and its button (never a chat box). */
function search(q = '', kind = '') {
    const k = kind && kind !== 'all' && KIND[kind] ? kind : '';
    const hint = k === 'models' ? 'Find an AI model: Gemini, Claude, Llama…' : k === 'businesses' ? 'Find a place: coffee, pharmacy…' : 'Search sites, tools, AI models, projects and places';
    return `<form class="dir-search" role="search" method="get" action="/search">${g('search', 20)}`
        + `<label class="ovk-sr" for="dir-q">Search the directory</label><input id="dir-q" type="search" name="q" value="${esc(q)}" maxlength="120" placeholder="${esc(hint)}" autocomplete="off" enterkeyhint="search">`
        + `${k ? `<input type="hidden" name="kind" value="${esc(k)}">` : ''}<button type="submit">Search</button></form>`;
}

/** A listing: its glyph on its directory's hue (or its first letter), what it is, and when it was last checked. */
function card(e) {
    const k = kindOf(e.kind);
    const sub = [e.group, e.maker, e.status === 'spotted' ? 'Spotted, not yet offered' : ''].filter(Boolean)[0] || '';
    return `<a class="dir-card" href="${entryPath(e)}" style="--h:${k.hue}">`
        + (e.kind === 'sites' && appIcon(e.id) ? `<span class="dir-app" aria-hidden="true">${appIcon(e.id)}</span>`
            : `<span class="dir-tile" aria-hidden="true">${e.kind === 'businesses' || e.kind === 'people' || e.kind === 'projects' ? `<b>${esc(String(e.name).trim().charAt(0).toUpperCase())}</b>` : g(k.glyph, 20)}</span>`)
        + `<span class="dir-card-t"><b>${esc(e.name)}</b>${e.description ? `<small>${esc(e.description)}</small>` : ''}`
        + `<span class="dir-meta">${sub ? `<em>${esc(sub)}</em>` : ''}<span>${g('check', 13)}Checked ${when(e.last_checked)}</span></span></span></a>`;
}

/** The directories as places: a side column on a computer, fixed tabs on a phone (kit-layout .ov-places). */
function places(kinds, counts, current) {
    return `<nav class="ov-places dir-places" aria-label="Directories">`
        + `<a href="/"${current === '' ? ' aria-current="page"' : ''}>${g('grid', 20)}<span>All</span></a>`
        + Object.entries(kinds).map(([id, name]) => `<a href="/kinds/${id}" style="--h:${kindOf(id).hue}"${current === id ? ' aria-current="page"' : ''}>${g(kindOf(id).glyph, 20)}<span>${esc(SHORT[id] || name)}</span>${counts && counts[id] ? `<em>${counts[id] > 999 ? `${Math.round(counts[id] / 100) / 10}k` : counts[id]}</em>` : ''}</a>`).join('')
        + `</nav>`;
}

function home(kinds, counts, entries, q = '') {
    const total = Object.values(counts || {}).reduce((a, n) => a + (Number(n) || 0), 0);
    const newest = entries.slice().sort((a, b) => String(b.last_checked).localeCompare(String(a.last_checked)));
    const checked = newest[0] ? newest[0].last_checked : null;
    const tiles = Object.entries(kinds).map(([id, name]) => {
        const k = kindOf(id);
        return `<a class="dir-kind" href="/kinds/${id}" style="--h:${k.hue}"><span class="dir-tile is-big" aria-hidden="true">${g(k.glyph, 26)}</span>`
            + `<span class="dir-kind-t"><b>${esc(name)}</b><small>${esc(k.line)}</small></span><span class="dir-count">${Number(counts[id] || 0).toLocaleString('en-US')}</span></a>`;
    }).join('');
    return `<header class="dir-hero"><p class="dir-eyebrow">${g('check', 14)}${total.toLocaleString('en-US')} listings · checked ${when(checked)}</p>`
        + `<h1>Everything, with its sources</h1><p class="dir-lede">OpenVibe sites and tools, AI models and their makers, open-source projects and local places. Each listing names where every fact came from and the day it was last checked.</p>`
        + `${search(q)}</header>`
        + `<section class="dir-sec" aria-labelledby="dir-kinds"><h2 id="dir-kinds">Directories</h2><div class="dir-kinds">${tiles}</div></section>`
        + `<section class="dir-sec" aria-labelledby="dir-recent"><div class="dir-sec-head"><h2 id="dir-recent">Recently checked</h2><a href="/search?q=">See everything</a></div>`
        + `<div class="dir-rail" data-ov-peek>${newest.slice(0, 16).map(card).join('')}</div></section>`
        + `<section class="dir-sec dir-claim"><span class="dir-tile is-big" style="--h:48" aria-hidden="true">${g('user', 26)}</span><div><h2>List yourself, on your terms</h2><p>Choose your name, a line about you and a website. Nothing else is shown, and you can take it down at any time.</p></div><a class="ovk-btn ovk-btn--primary" href="/people/me">Your listing</a></section>`;
}

const PER_PAGE = 60;
/** One directory (or a search): the places, the search inside it, and its listings a page at a time. */
function listing(kind, name, entries, q = '', { page: n = 1, counts = null, kinds = null } = {}) {
    const pageN = Math.max(1, Number(n) || 1);
    const pages = Math.max(1, Math.ceil(entries.length / PER_PAGE));
    const shown = entries.slice((pageN - 1) * PER_PAGE, pageN * PER_PAGE);
    const k = kindOf(kind);
    const more = (p) => `?${new URLSearchParams({ ...(q ? { q } : {}), ...(kind && kind !== 'all' && q !== undefined && name === 'Search directory' ? { kind } : {}), page: String(p) })}`;
    const nav = pages > 1 ? `<nav class="dir-pages" aria-label="Pages">${pageN > 1 ? `<a class="ovk-btn" href="${esc(more(pageN - 1))}">Newer</a>` : ''}<span>Page ${pageN} of ${pages}</span>${pageN < pages ? `<a class="ovk-btn ovk-btn--primary" href="${esc(more(pageN + 1))}">More</a>` : ''}</nav>` : '';
    return `<div class="ov-sidebar dir-layout" style="--side:15rem;--min:62%">${kinds ? places(kinds, counts, kind === 'all' ? '' : kind) : '<span></span>'}`
        + `<div class="dir-main"><header class="dir-head" style="--h:${k.hue}"><span class="dir-tile is-big" aria-hidden="true">${g(name === 'Search directory' ? 'search' : k.glyph, 26)}</span>`
        + `<div><h1>${esc(name === 'Search directory' ? (q ? `“${q}”` : 'Everything') : name)}</h1><p>${entries.length.toLocaleString('en-US')} listing${entries.length === 1 ? '' : 's'}${k.line && name !== 'Search directory' ? ` · ${esc(k.line)}` : ''}</p></div></header>`
        + search(q, kind)
        + (shown.length ? `<div class="dir-grid">${shown.map(card).join('')}</div>${nav}` : `<p class="dir-none">${q ? 'Nothing matches those words. Try fewer, or another directory.' : 'No listings yet: the source is checked again on the next refresh.'}</p>`)
        + `</div></div>`;
}

function detail(e) {
    const k = kindOf(e.kind);
    const rows = [
        e.website ? ['Website', `<a href="${esc(e.website)}" rel="noopener">${esc(e.website.replace(/^https:\/\//, '').replace(/\/$/, ''))}</a>`] : null,
        e.phone ? ['Phone (as the business publishes it)', esc(e.phone)] : null,
        e.group ? ['Group', esc(e.group)] : null,
        e.maker ? ['Maker', esc(e.maker)] : null,
        e.context ? ['Context', `${Number(e.context).toLocaleString('en-US')} tokens`] : null,
        ['Last checked', when(e.last_checked, 'datetime')],
    ].filter(Boolean);
    return `<nav class="dir-crumbs" aria-label="Where you are"><a href="/">Directories</a>${g('chevron', 14)}<a href="/kinds/${esc(e.kind)}">${esc(require('./sources').kinds[e.kind] || e.kind)}</a></nav>`
        + `<header class="dir-head is-entry" style="--h:${k.hue}"><span class="dir-tile is-big" aria-hidden="true">${g(k.glyph, 28)}</span><div><h1>${esc(e.name)}</h1>${e.description ? `<p>${esc(e.description)}</p>` : ''}</div></header>`
        + `<div class="dir-actions">${e.website ? `<a class="ovk-btn ovk-btn--primary" href="${esc(e.website)}" rel="noopener">${g('open', 16)}Open the website</a>` : ''}<a class="ovk-btn" href="https://openvibe.help/tickets/new?site=directory&amp;about=${encodeURIComponent(entryPath(e))}">Report a problem</a></div>`
        + `<section class="dir-sec"><h2>The facts</h2><dl class="dir-facts">${rows.map(([dt, dd]) => `<div><dt>${esc(dt)}</dt><dd>${dd}</dd></div>`).join('')}</dl></section>`
        + `<section class="dir-sec"><h2>Where they came from</h2><ul class="dir-sources">${e.sources.map((s) => `<li>${g('link', 16)}<a href="${esc(s.url)}" rel="noopener">${esc(s.url.replace(/^https:\/\//, ''))}</a><small>checked ${when(s.checked_at)}</small></li>`).join('')}</ul>`
        + `${e.osm_attribution ? `<p class="dir-fine">${esc(e.osm_attribution)} · <a href="https://www.openstreetmap.org/copyright">Licence and attribution</a></p>` : ''}`
        + `<p class="dir-fine">As data: <a href="/api/v1/entries/${esc(e.kind)}/${encodeURIComponent(e.slug)}">JSON</a> · <a href="${entryPath(e)}" type="text/markdown">Markdown</a> (ask for text/markdown)</p></section>`;
}

function markdown(e) {
    return `# ${e.name}\n\n${e.description}\n\nKind: ${e.kind}\nLast checked: ${e.last_checked}\n${e.website ? `Website: ${e.website}\n` : ''}${e.phone ? `Business-published phone: ${e.phone}\n` : ''}\nSources:\n${e.sources.map((s) => `- ${s.url} (checked ${s.checked_at})`).join('\n')}\n`;
}

function peopleForm(row) {
    return `<header class="dir-head" style="--h:48"><span class="dir-tile is-big" aria-hidden="true">${g('user', 26)}</span><div><h1>Your listing</h1><p>Choose what to publish in the opt-in people directory. Only these three things appear, and only when you publish.</p></div></header>`
        + `<form id="people-form" class="dir-form"><label>Display name <input name="display_name" maxlength="100" required value="${esc(row?.display_name || '')}"></label>`
        + `<label>About <textarea name="bio" maxlength="500" rows="4">${esc(row?.bio || '')}</textarea></label>`
        + `<label>Website <input name="website" type="url" placeholder="https://" value="${esc(row?.website || '')}"></label>`
        + `<label class="dir-check"><input name="visible" type="checkbox" ${row?.visible ? 'checked' : ''}> Publish my listing</label>`
        + `<p class="dir-fine">You can unpublish or delete this entry at any time.</p>`
        + `<div class="dir-actions"><button class="ovk-btn ovk-btn--primary" type="submit">Save listing</button><button class="ovk-btn ovk-btn--quiet" type="button" id="delete-listing">Delete listing</button></div></form>`
        + `<p id="people-result" role="status"></p><script src="/people.js" defer></script>`;
}

module.exports = { page, card, home, listing, detail, markdown, peopleForm, esc, json, entryPath, search, places, PER_PAGE };
