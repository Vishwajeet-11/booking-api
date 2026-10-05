# Task 4 — System Design

**Scenario:** `GET /artists/search` times out at 50,000 users (up from 1,000). MySQL CPU sits at 90% during peak hours. 48 hours available, no downtime allowed.

## 1. Most likely causes, and what I'd check first

The two most likely causes are **missing or inadequate indexes on the search's filter/sort columns** (category, location, price range, rating, availability), forcing full table scans that got 50x more expensive as the table grew, and **the search query recomputing aggregate data live** — e.g. joining out to reviews/bookings to compute an artist's rating or availability on every single search request instead of reading a precomputed value.

To confirm: I'd run `EXPLAIN` (or `EXPLAIN ANALYZE`) on the actual search query to see whether it's doing a full table scan (`type: ALL`) versus using an index, check MySQL's slow query log for exactly which query dominates CPU during peak hours, and check `SHOW PROCESSLIST` for lock contention or many concurrent copies of the same slow query stacking up. If `EXPLAIN` shows no usable index on the filter columns, that's cause #1 confirmed; if the query plan is fine but involves heavy joins/aggregation per row, that points to cause #2.

## 2. 48-hour fix

Two concrete changes, no rewrite, no downtime:

1. **Add composite indexes** covering the actual filter + sort columns the search uses (e.g. `(category, city, hourly_rate)` or whatever the real predicate is), added with `ALGORITHM=INPLACE, LOCK=NONE` so the table stays writable while the index builds. This is almost always the single biggest win when a query that used to be fine at 1,000 rows is now timing out at 50,000 users' worth of data.
2. **Add a short-TTL cache (Redis) in front of the search endpoint**, keyed by the normalized query parameters, with a TTL of e.g. 30–60 seconds. Artist search results don't need to be second-by-second fresh, and search traffic is naturally repetitive (many users searching similar categories/cities), so even a short cache absorbs a large fraction of read load immediately. I'd also double check pagination is enforced server-side (hard cap on `limit`) so a single request can't force a huge scan.

Together these two changes target both likely root causes without touching the application's architecture, and can both be deployed without taking the platform offline.

## 3. Long-term fix, and its trade-off

The durable fix is to **move search off the live transactional MySQL store entirely**, into a read-optimized system built for exactly this kind of query — either a dedicated search engine (Elasticsearch/OpenSearch) or a denormalized, precomputed read model (a CQRS-style "artist search index" table/collection) kept in sync via events whenever an artist, booking, or review changes. Search then reads from that index, not from live joins across `artists`, `bookings`, and `reviews`. Alongside this, I'd add a MySQL read replica for any search-adjacent reads that still need to hit SQL directly, so transactional writes (bookings, payments) are never competing with read-heavy search traffic on the same primary.

**Trade-off:** this introduces eventual consistency — a brand-new artist, or a review that just came in, may take a few seconds (or longer, depending on the sync mechanism) to show up in search results — and it adds a second system to run, monitor, and keep in sync with the source of truth. That's a reasonable trade for a search endpoint, where "a few seconds stale" is invisible to users but "times out under load" is not.
