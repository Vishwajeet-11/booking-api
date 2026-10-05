# Task 4 — System Design

`GET /artists/search` times out after growth from 1,000 to 50,000 users. MySQL CPU is at 90% at peak. There are 48 hours, and the platform cannot go offline.

## 1. Most likely causes, and what I'd check first

The two most likely causes are missing indexes on the search filter and sort columns, so each request scans tables that are now far larger, and the search recomputing rating or availability by joining reviews and bookings on every request.

I would confirm with `EXPLAIN` on the live query, looking for `type: ALL`, the slow query log during peak, and `SHOW PROCESSLIST` for many copies of the same statement. No usable index confirms the first cause. A fine plan that still aggregates per row confirms the second.

## 2. 48-hour fix

Add a composite index on the real filter and sort columns, using `ALGORITHM=INPLACE, LOCK=NONE` so writes continue. Put a 30–60 second Redis cache in front of search, keyed by the normalized query, and cap `limit` so one request cannot scan a huge page. Both ship without downtime.

## 3. Long-term fix, and its trade-off

Move search off the transactional primary into a search engine or a denormalized read model, updated when an artist, booking, or review changes. Keep booking writes on MySQL.

The trade-off is eventual consistency and a second system to operate. A few seconds of staleness is acceptable for search. Timeouts under load are not.
