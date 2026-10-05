const mongoose = require('mongoose');

// Document-shaped, loosely-structured data that doesn't fit well in a rigid
// relational row: bio copy, a variable-length portfolio, social links, tags.
// Keyed by the MySQL `artists.id` (NOT a Mongo ObjectId reference) so the two
// stores stay loosely coupled — the relational side is the source of truth
// for identity, this is enrichment.
const artistProfileSchema = new mongoose.Schema(
  {
    artistId: { type: Number, required: true, unique: true, index: true },
    displayName: { type: String, required: true },
    bio: { type: String, default: '' },
    tags: { type: [String], default: [] },
    portfolio: [
      {
        title: String,
        imageUrl: String,
      },
    ],
    socialLinks: {
      instagram: String,
      website: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ArtistProfile', artistProfileSchema);
