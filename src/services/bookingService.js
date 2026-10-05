const bookingModel = require('../models/mysql/bookingModel');
const artistModel = require('../models/mysql/artistModel');
const AppError = require('../utils/AppError');

// Valid next states for each current state. An empty array means terminal.
const TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
};

const ALL_STATUSES = Object.keys(TRANSITIONS);

async function createBooking(clientId, { artist_id, event_start, event_end, notes }) {
  if (!artist_id || !event_start || !event_end || notes === undefined) {
    throw new AppError(400, 'artist_id, event_start, event_end and notes are all required');
  }

  const start = new Date(event_start);
  const end = new Date(event_end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError(400, 'event_start and event_end must be valid dates');
  }
  if (end <= start) {
    throw new AppError(400, 'event_end must be after event_start');
  }
  if (start < new Date()) {
    throw new AppError(422, 'event_start cannot be in the past');
  }

  const artist = await artistModel.findById(artist_id);
  if (!artist) {
    throw new AppError(404, `No artist found with id ${artist_id}`);
  }

  const overlaps = await bookingModel.hasConfirmedOverlap(artist_id, start, end);
  if (overlaps) {
    throw new AppError(422, 'This artist already has a confirmed booking that overlaps this time window');
  }

  return bookingModel.create({
    clientId,
    artistId: artist_id,
    eventStart: start,
    eventEnd: end,
    notes,
  });
}

async function updateBookingStatus(bookingId, requestingUser, newStatus) {
  if (!ALL_STATUSES.includes(newStatus)) {
    throw new AppError(422, `Unknown status '${newStatus}'`);
  }

  const booking = await bookingModel.findById(bookingId);
  if (!booking) {
    throw new AppError(404, `No booking found with id ${bookingId}`);
  }

  // Ownership: a client may only touch their own booking; an artist may
  // only touch bookings assigned to them.
  if (requestingUser.role === 'client' && booking.client_id !== requestingUser.userId) {
    throw new AppError(403, 'You can only update your own bookings');
  }
  if (requestingUser.role === 'artist') {
    const artistProfile = await artistModel.findByUserId(requestingUser.userId);
    if (!artistProfile || artistProfile.id !== booking.artist_id) {
      throw new AppError(403, 'You can only update bookings assigned to you');
    }
  }

  const allowedNext = TRANSITIONS[booking.status] || [];
  if (!allowedNext.includes(newStatus)) {
    throw new AppError(
      422,
      `Cannot transition a booking from '${booking.status}' to '${newStatus}'`
    );
  }

  // Of the structurally valid transitions, only cancellation is open to
  // clients — confirm/in_progress/completed are artist-only actions.
  if (newStatus !== 'cancelled' && requestingUser.role !== 'artist') {
    throw new AppError(
      422,
      `Clients cannot transition a booking to '${newStatus}'; only the assigned artist can`
    );
  }

  return bookingModel.updateStatus(bookingId, newStatus);
}

module.exports = { createBooking, updateBookingStatus, TRANSITIONS };
