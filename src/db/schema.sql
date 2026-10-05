-- Booking API — MySQL schema
-- Relational, transactional data: users (auth), artists (business profile),
-- bookings, and reviews. Artist bio/portfolio content lives in MongoDB (see
-- src/models/mongo/ArtistProfile.js) since it's flexible, document-shaped data.
--
-- This schema already applies the fixes discussed in TASK3.md (Task B):
-- explicit foreign keys, indexes on hot lookup paths, constrained status
-- values, DECIMAL for money, and a uniqueness constraint on reviews.

CREATE TABLE IF NOT EXISTS users (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('client', 'artist') NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- Business/artist profile. Separate from `users` because not every piece of
-- "artist" data (category, rate) is auth-related, and it keeps the auth
-- table lean. One artist profile per artist user.
CREATE TABLE IF NOT EXISTS artists (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  user_id       INT NOT NULL,
  category      VARCHAR(100) NOT NULL,
  hourly_rate   DECIMAL(10, 2) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_artists_user_id (user_id),
  KEY idx_artists_category (category),
  CONSTRAINT fk_artists_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bookings (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  client_id     INT NOT NULL,
  artist_id     INT NOT NULL,
  event_start   DATETIME NOT NULL,
  event_end     DATETIME NOT NULL,
  notes         TEXT,
  status        ENUM('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')
                  NOT NULL DEFAULT 'pending',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_bookings_client FOREIGN KEY (client_id) REFERENCES users(id),
  CONSTRAINT fk_bookings_artist FOREIGN KEY (artist_id) REFERENCES artists(id),
  -- Speeds up the overlap check (artist_id + time range) and status filters.
  KEY idx_bookings_artist_time (artist_id, event_start, event_end),
  KEY idx_bookings_status (status),
  KEY idx_bookings_client (client_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reviews (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  booking_id    INT NOT NULL,
  artist_id     INT NOT NULL,
  client_id     INT NOT NULL,
  score         TINYINT NOT NULL,
  comment       TEXT,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- One review per booking.
  UNIQUE KEY uq_reviews_booking (booking_id),
  -- Leaderboard / per-artist review lookups filter by artist_id and sort by
  -- recency, and the 90-day leaderboard window scans created_at.
  KEY idx_reviews_artist_created (artist_id, created_at),
  CONSTRAINT fk_reviews_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
  CONSTRAINT fk_reviews_artist FOREIGN KEY (artist_id) REFERENCES artists(id),
  CONSTRAINT fk_reviews_client FOREIGN KEY (client_id) REFERENCES users(id),
  CONSTRAINT chk_reviews_score CHECK (score BETWEEN 1 AND 5)
) ENGINE=InnoDB;
