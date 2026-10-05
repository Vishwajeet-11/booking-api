require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { getPool, closePool } = require('../config/mysql');
const { connectMongo, disconnectMongo } = require('../config/mongo');
const ArtistProfile = require('../models/mongo/ArtistProfile');

const SAMPLE_PASSWORD = 'password123';

async function applySchema(pool) {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const statements = schemaSql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await pool.query(statement);
  }
}

async function seedMysql(pool) {
  const passwordHash = await bcrypt.hash(SAMPLE_PASSWORD, 10);

  // Clear tables in FK-safe order so re-running seed is idempotent.
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  await pool.query('TRUNCATE TABLE reviews');
  await pool.query('TRUNCATE TABLE bookings');
  await pool.query('TRUNCATE TABLE artists');
  await pool.query('TRUNCATE TABLE users');
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');

  const clients = [
    ['Riya Shah', 'riya@example.com'],
    ['Karan Mehta', 'karan@example.com'],
  ];
  const artistUsers = [
    ['Aanya Verma', 'aanya@example.com', 'Painter', 1500],
    ['Dev Kapoor', 'dev@example.com', 'Musician', 2500],
    ['Simran Kaur', 'simran@example.com', 'Photographer', 2000],
  ];

  const clientIds = [];
  for (const [name, email] of clients) {
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, 'client']
    );
    clientIds.push(result.insertId);
  }

  const artistRows = [];
  for (const [name, email, category, rate] of artistUsers) {
    const [userResult] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, 'artist']
    );
    const userId = userResult.insertId;
    const [artistResult] = await pool.query(
      'INSERT INTO artists (user_id, category, hourly_rate) VALUES (?, ?, ?)',
      [userId, category, rate]
    );
    artistRows.push({ artistId: artistResult.insertId, userId, name, category });
  }

  // A handful of completed bookings (with reviews) per artist, plus one
  // pending and one confirmed booking so the status-transition flow has
  // something to exercise right after seeding.
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  let bookingCount = 0;
  let reviewCount = 0;

  for (const artist of artistRows) {
    for (let i = 0; i < 6; i += 1) {
      const clientId = clientIds[i % clientIds.length];
      const start = new Date(now - (10 + i * 7) * DAY);
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

      const [bookingResult] = await pool.query(
        `INSERT INTO bookings (client_id, artist_id, event_start, event_end, notes, status)
         VALUES (?, ?, ?, ?, ?, 'completed')`,
        [clientId, artist.artistId, start, end, `Booking #${i + 1} for ${artist.name}`]
      );
      bookingCount += 1;

      const score = [5, 4, 5, 3, 4, 5][i % 6];
      await pool.query(
        'INSERT INTO reviews (booking_id, artist_id, client_id, score, comment) VALUES (?, ?, ?, ?, ?)',
        [bookingResult.insertId, artist.artistId, clientId, score, `Great experience with ${artist.name}!`]
      );
      reviewCount += 1;
    }

    // One booking still pending, awaiting the artist's confirmation.
    const pendingStart = new Date(now + 5 * DAY);
    const pendingEnd = new Date(pendingStart.getTime() + 3 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO bookings (client_id, artist_id, event_start, event_end, notes, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [clientIds[0], artist.artistId, pendingStart, pendingEnd, `Upcoming booking for ${artist.name}`]
    );
    bookingCount += 1;
  }

  return { clientIds, artistRows, bookingCount, reviewCount };
}

async function seedMongo(artistRows) {
  await ArtistProfile.deleteMany({});
  const docs = artistRows.map((artist) => ({
    artistId: artist.artistId,
    displayName: artist.name,
    bio: `${artist.name} is a ${artist.category.toLowerCase()} based in India, booked through Book An Artist.`,
    tags: [artist.category.toLowerCase()],
    portfolio: [{ title: 'Featured work', imageUrl: 'https://example.com/portfolio/1.jpg' }],
    socialLinks: { instagram: `https://instagram.com/${artist.name.split(' ')[0].toLowerCase()}` },
  }));
  await ArtistProfile.insertMany(docs);
}

async function run() {
  const pool = getPool();
  console.log('Applying schema...');
  await applySchema(pool);

  console.log('Seeding MySQL...');
  const { artistRows, bookingCount, reviewCount } = await seedMysql(pool);

  console.log('Seeding MongoDB...');
  await connectMongo();
  await seedMongo(artistRows);

  console.log('\nSeed complete.');
  console.log(`  Users: ${artistRows.length} artists, 2 clients`);
  console.log(`  Bookings: ${bookingCount}`);
  console.log(`  Reviews: ${reviewCount}`);
  console.log(`  All accounts use password: ${SAMPLE_PASSWORD}`);
  console.log('\nSample logins:');
  console.log('  Client:  riya@example.com');
  console.log('  Artist:  aanya@example.com  (artist_id = %d)', artistRows[0].artistId);

  await disconnectMongo();
  await closePool();
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
