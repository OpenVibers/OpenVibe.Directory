# OpenVibe.Directory

Source-linked directories for OpenVibe sites and tools, AI models and providers, open-source projects, and local businesses from OpenStreetMap. Every entry has a source and a last checked date. Public sources are refreshed at startup and every six hours; a failed source keeps its last successful in-memory snapshot and exposes the failure in `/api/v1/kinds`.

Business listings are a bounded San Francisco pilot sourced from OpenStreetMap under ODbL 1.0. Phone numbers appear only when published on the mapped business. Private-person searches and reverse lookups are excluded. People can sign in to claim, edit, unpublish, and delete only their own entry; an entry is private until they explicitly publish it. The form offers no age, city, or phone fields.

Run `npm ci`, then `node server/index.js`. Check `/api/v1/kinds`, `/api/v1/entries`, `/sitemap.xml`, and `/llms.txt`.
