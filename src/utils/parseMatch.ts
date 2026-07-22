import { MatchDetails } from '../types/api';

const GENERIC_RULES = [
  'Be there 10 minutes before kickoff.',
  'No aggressive behavior or slide tackling.',
  'Bibs and balls will be provided by the venue.',
  'Last minute cancellations are non-refundable.',
];

const combineDateTime = (date?: string, time?: string) => {
  if (!date) return undefined;
  // backend sends LocalDate ("2026-06-16") and LocalTime ("18:00:00") separately
  return time ? `${date}T${time}` : date;
};

// Builds the UI-facing MatchDetails model from whatever the backend's
// GET /bookings/my actually returns today (com.pasxo.dto.booking.BookingResponse:
// id, userId, futsalId, futsalName, slotId, slotDate, startTime, endTime,
// status, bookedAt). Fields the backend doesn't expose yet (price, sport
// type, organizer, participants, amenities, rules, images...) fall back to
// placeholders below, clearly marked, so the UI keeps working and can pick
// up the real values automatically once the backend adds them.
export const parseMatchDetails = (raw: any): MatchDetails => {
  const data = raw?.data || raw?.booking || raw?.match || raw || {};

  const futsalId = data.futsalId ?? data.venueId;
  const slotId = data.slotId;
  const status = (data.status || 'CONFIRMED') as MatchDetails['status'];
  const venueName = data.futsalName || data.locationName || data.venue?.name || 'Venue TBD';

  return {
    id: String(data.id ?? data._id ?? data.bookingId ?? ''),
    futsalId,
    slotId,
    title: data.title
      || (venueName !== 'Venue TBD' ? `Match at ${venueName}` : 'Match'),
    // Booking.sport is the real field now (create-match.tsx sends it); sportType
    // is a legacy/placeholder fallback kept in case an older booking never set it.
    sportType: data.sport || data.sportType || 'FUTSAL',
    level: data.level,
    images: Array.isArray(data.images) && data.images.length > 0
      ? data.images
      : data.imageBase64
      ? [`data:image/jpeg;base64,${data.imageBase64}`]
      : [],
    startDate: data.startDate || combineDateTime(data.slotDate, data.startTime),
    endDate: data.endDate || combineDateTime(data.slotDate, data.endTime),
    venue: {
      id: futsalId != null ? String(futsalId) : undefined,
      name: venueName,
      // address/city/postcode/coordinates/amenities aren't returned by BookingResponse yet
      address: data.venue?.address,
      postcode: data.venue?.postcode,
      city: data.venue?.city,
      country: data.venue?.country,
      latitude: data.venue?.latitude ?? data.latitude,
      longitude: data.venue?.longitude ?? data.longitude,
      amenities: data.venue?.amenities,
    },
    organizer: undefined,
    participants: Array.isArray(data.players) && data.players.length > 0
      ? data.players.map((p: any, i: number) => {
          // Backend now returns enriched objects: { firebaseUid, displayName, profileImageUrl }
          // But support legacy string UID arrays for backward compat
          if (typeof p === 'string') return { id: p, name: `Player ${i + 1}`, avatarUrl: undefined };
          return {
            id: p.firebaseUid ?? p.id ?? String(i),
            name: p.displayName || p.name || `Player ${i + 1}`,
            avatarUrl: p.profileImageUrl ?? p.avatarUrl ?? undefined,
          };
        })
      : [],
    joinedPlayers: data.joinedPlayersCount ?? data.joinedPlayers,
    maxSpots: data.maxPlayers ?? data.maxSpots ?? data.maxCapacity,
    minPlayers: data.minPlayers ?? data.minSpots ?? undefined,
    spotsLeft: data.spotsLeft,
    pricePerSlot: data.pricePerSlot ?? data.price,
    slotCount: data.slotCount ?? 1,
    pricePerPlayer: data.pricePerPlayer ?? undefined,
    serviceFeePercent: data.serviceFeePercent ?? 0,
    totalPrice: data.totalPrice ?? data.pricePerSlot ?? data.price,
    currencySymbol: data.currencySymbol || 'LKR ',
    rules: Array.isArray(data.rules) && data.rules.length > 0 ? data.rules : GENERIC_RULES,
    description: data.description,
    creatorId: data.userId,
    bookingConfirmed: status === 'CONFIRMED' || status === 'ACTIVE_MATCH',
    pitchLabel: data.pitchLabel,
    status,
    vendorStatus: data.vendorStatus ?? (
      status === 'PENDING_VENDOR' || status === 'PENDING' ? 'PENDING_VENDOR'
      : status === 'ACTIVE_MATCH' || status === 'CONFIRMED' ? 'ACTIVE_MATCH'
      : undefined
    ),
    rejectionReason: data.rejectionReason,
    bookedAt: data.bookedAt,
  };
};
