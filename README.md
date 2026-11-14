# OpenVibe.Directory

Site: [openvibe.directory](https://openvibe.directory) · API: [api/v1/kinds](https://openvibe.directory/api/v1/kinds) · Discovery: [/llms.txt](https://openvibe.directory/llms.txt)

Source-linked directories for OpenVibe sites and tools, AI models and providers, open-source projects, and local businesses from OpenStreetMap. Every entry has a source and a last checked date. Public sources are refreshed at startup and every six hours; a failed source keeps its last successful in-memory snapshot and exposes the failure in `/api/v1/kinds`.

Business listings are a bounded San Francisco pilot sourced from OpenStreetMap under ODbL 1.0. Unverified OpenStreetMap phone tags are omitted; a business number needs a business-owned source before publication. Private-person searches and reverse lookups are excluded. People can sign in to claim, edit, unpublish, and delete only their own entry; an entry is private until they explicitly publish it. The form offers no age, city, or phone fields.

Run `npm ci`, then `node server/index.js`. Check `/api/v1/kinds`, `/api/v1/entries`, `/sitemap.xml`, and `/llms.txt`.

The opt-in people table is created at startup through `DATABASE_DIRECT_URL` (owner connection). Listing reads and writes use `DATABASE_URL` (runtime connection).

<!-- versions:start -->
- openvibe-sdk: v0.168.0
- openvibe-shared: v4.255.0
<!-- versions:end -->
