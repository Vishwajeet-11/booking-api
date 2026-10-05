# Task 3 — SQL & Database

## Task A — Leaderboard query

**Endpoint:** `GET /artists/leaderboard`
**Implementation:** `src/models/mysql/reviewModel.js` → `leaderboard()`, served at `GET /artists/leaderboard`.

```sql
SELECT
    a.id AS artist_id,
    u.name AS artist_name,
    a.category,
    ROUND(AVG(r.score), 2) AS average_score,
    COUNT(DISTINCT r.id) AS review_count,
    (
      SELECT COUNT(*)
      FROM bookings b2
      WHERE b2.artist_id = a.id
        AND b2.status = 'completed'
    ) AS completed_booking_count
FROM artists a
JOIN users u ON u.id = a.user_id
JOIN reviews r ON r.artist_id = a.id
JOIN bookings b ON b.id = r.booking_id
WHERE r.created_at >= (CURRENT_DATE - INTERVAL 90 DAY)
  AND b.status = 'completed'
GROUP BY a.id, u.name, a.category
HAVING COUNT(DISTINCT r.id) >= 5
ORDER BY average_score DESC, completed_booking_count DESC
LIMIT 10;
```

Notes on the query itself:
- Reviews are only ever created against `completed` bookings in this codebase (see `reviewService.createReview`), so the `b.status = 'completed'` filter is mostly a defensive, explicit guard — it also protects the query if that invariant is ever relaxed.
- `COUNT(DISTINCT r.id)` rather than a plain `COUNT(*)` because the join through `bookings` is 1:1 per review in this schema, but using `DISTINCT` makes the intent ("count of reviews", not "count of joined rows") explicit and safe if the join shape ever changes.
- `completed_booking_count` is a separate count of all of that artist's completed bookings, not a recount of the reviews in the window. Counting bookings through the review join would always equal `review_count` (one review per booking), so it could never break a tie.
- The 90-day window is applied on `reviews.created_at` — i.e. "reviews left in the last 90 days" — rather than on `bookings.event_start`, since the leaderboard is meant to reflect recent reputation, not recent event dates. The window filters who qualifies and what the average is. The tiebreaker is the artist's total completed work.

### Which indexes would you add, and why?

1. **`reviews(artist_id, created_at)`** — the query's two main access patterns are "all reviews for artist X" and "...within the last 90 days", so a composite index on `(artist_id, created_at)` lets MySQL seek straight to an artist's recent reviews instead of scanning the whole table. This is the single most important index for this query, and it's the one in `schema.sql` (`idx_reviews_artist_created`).
2. **`bookings(id)`** — already the primary key, so the `JOIN bookings b ON b.id = r.booking_id` is a primary-key lookup and needs no extra index. The completed-count subquery filters `bookings` by `artist_id` and `status`; `idx_bookings_artist_time` already leads with `artist_id`, so that lookup is an index range rather than a scan.
3. **`reviews(booking_id)`** — already covered by the `UNIQUE KEY uq_reviews_booking` constraint, which doubles as an index and makes `r.artist_id = a.id` style joins and the booking→review lookup fast.
4. **`artists(user_id)`** — already unique-indexed (`uq_artists_user_id`), which keeps the `artists JOIN users` fast in both directions.

I would *not* add a separate index on `reviews.score` — it's only ever aggregated (`AVG`), never filtered or sorted on directly in this query, so an index on it wouldn't be used here and would just add write overhead.

### At tens of millions of rows, how would you avoid running this on every request?

The query re-aggregates the full 90-day review history on every call, which gets expensive as `reviews` grows into the tens of millions — the `GROUP BY` and `HAVING` can't be fully satisfied by an index alone at that scale. I'd:

1. **Cache the result.** The leaderboard doesn't need to be real-time — cache the top-10 list in Redis (or similar) with a short TTL (e.g. 5–15 minutes) and serve from cache on `GET /artists/leaderboard`. This alone removes almost all read load from MySQL for this endpoint.
2. **Precompute instead of aggregating live.** Maintain a small `artist_leaderboard_snapshot` table (artist_id, average_score, review_count, completed_booking_count, computed_at), refreshed by a scheduled job (e.g. every 10–15 minutes) that runs the aggregation once and writes the top N rows. The endpoint then becomes a trivial `SELECT * FROM artist_leaderboard_snapshot ORDER BY average_score DESC LIMIT 10` — no joins, no aggregation, at read time.
3. **Incremental maintenance (longer-term).** Instead of recomputing the whole window from scratch, maintain a running sum/count per artist (e.g. via a trigger or an event-driven update when a review is created) and periodically expire entries older than 90 days, so the "recompute" job only reconciles drift rather than scanning everything.

The trade-off in all three cases is staleness: the leaderboard would lag actual review activity by however long the cache TTL / refresh interval is, which is a reasonable trade for a leaderboard (as opposed to, say, a booking's live status).

---

## Task B — Schema audit

The original schema (as given in the assignment) has the following five problems:

```sql
CREATE TABLE artists (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255),
  category VARCHAR(255),
  hourly_rate FLOAT,
  created_at DATETIME
);

CREATE TABLE bookings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  artist_id INT,
  client_id INT,
  status VARCHAR(50),
  amount FLOAT,
  event_start DATETIME,
  event_end DATETIME,
  created_at DATETIME
);

CREATE TABLE reviews (
  id INT PRIMARY KEY AUTO_INCREMENT,
  booking_id INT,
  artist_id INT,
  score INT,
  comment TEXT,
  created_at DATETIME
);
```

### 1. No foreign keys

**Problem:** `bookings.artist_id`, `bookings.client_id`, `reviews.booking_id` and `reviews.artist_id` are plain `INT` columns with no `FOREIGN KEY` constraint tying them back to their parent tables.
**Why it matters:** Nothing stops a booking from referencing an artist that doesn't exist, or a review from pointing at a deleted booking. Referential integrity bugs like this are silent at write time and surface later as confusing nulls/joins in production.
**Fix:**
```sql
ALTER TABLE bookings
  ADD CONSTRAINT fk_bookings_artist FOREIGN KEY (artist_id) REFERENCES artists(id),
  ADD CONSTRAINT fk_bookings_client FOREIGN KEY (client_id) REFERENCES users(id);

ALTER TABLE reviews
  ADD CONSTRAINT fk_reviews_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
  ADD CONSTRAINT fk_reviews_artist FOREIGN KEY (artist_id) REFERENCES artists(id);
```

### 2. No indexes on frequently-queried columns

**Problem:** `bookings.artist_id` (used for the overlap check on every new booking, and for per-artist lookups) and `reviews.artist_id` (used for per-artist reviews and the leaderboard) have no index at all.
**Why it matters:** As the tables grow, every overlap check, status lookup, or review fetch becomes a full table scan — this is exactly what causes the kind of CPU blowup described in Task 4.
**Fix:**
```sql
ALTER TABLE bookings
  ADD INDEX idx_bookings_artist_time (artist_id, event_start, event_end),
  ADD INDEX idx_bookings_status (status);

ALTER TABLE reviews
  ADD INDEX idx_reviews_artist_created (artist_id, created_at);
```

### 3. `status` is an unconstrained `VARCHAR(50)`

**Problem:** `bookings.status` can hold literally any string — `'Confirmed'`, `'CONFIRMD'`, `'done'` — with nothing enforcing the actual state machine (`pending` / `confirmed` / `in_progress` / `completed` / `cancelled`) at the database level.
**Why it matters:** The application can validate this on the way in, but any other process that writes to this table (a script, a migration, a different service down the line) can silently corrupt the state machine, and typos become business-logic bugs that are hard to trace.
**Fix:**
```sql
ALTER TABLE bookings
  MODIFY COLUMN status ENUM('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')
  NOT NULL DEFAULT 'pending';
```

### 4. Money stored as `FLOAT`

**Problem:** `artists.hourly_rate` and `bookings.amount` are `FLOAT`.
**Why it matters:** `FLOAT` (and `DOUBLE`) are binary floating-point types that cannot represent most decimal fractions exactly — `0.1 + 0.2` famously isn't `0.3`. Over many bookings/payments this produces real rounding drift in financial totals, which is unacceptable for money.
**Fix:**
```sql
ALTER TABLE artists MODIFY COLUMN hourly_rate DECIMAL(10, 2) NOT NULL;
ALTER TABLE bookings MODIFY COLUMN amount DECIMAL(10, 2) NOT NULL;
```

### 5. No uniqueness constraint on `reviews.booking_id`

**Problem:** Nothing stops the same booking from being reviewed multiple times — `reviews.booking_id` has no `UNIQUE` constraint.
**Why it matters:** A client could (accidentally via a retried request, or intentionally) submit several reviews for one booking, skewing an artist's average score and review count — directly corrupting the leaderboard and the public review summary.
**Fix:**
```sql
ALTER TABLE reviews ADD UNIQUE KEY uq_reviews_booking (booking_id);
```

*(A sixth, smaller issue worth a mention: none of the three tables have an `updated_at` column, so there's no way to audit when a booking's status last changed. `schema.sql` in this repo adds `updated_at ... ON UPDATE CURRENT_TIMESTAMP` to `bookings` for that reason.)*

The running application's actual schema (`src/db/schema.sql`) already incorporates all five fixes above, plus `NOT NULL` constraints and a `CHECK (score BETWEEN 1 AND 5)` on reviews.
