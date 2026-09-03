export interface AuthResponse {
  idToken: string;
  refreshToken?: string;
  user?: UserProfile;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  displayName: string;
  phoneNumber: string;
  sports: string[];
  referralCode?: string;
  profileImage?: {
    uri: string;
    name: string;
    type: string;
  };
}

export interface UserProfile {
  id: string;
  firebaseUid: string;
  email: string;
  password: string;
  displayName: string;
  phoneNumber: string;
  sport: string | string[];
  sports?: string[];
  skillLevel: string;
  locationAccess: boolean;
  referralCode?: string;
  bio?: string;
  profileImageUrl?: string | { uri: string; name: string; type: string };
  authProvider?: string;
  // False only for a first-time Google sign-in that hasn't picked an
  // activity yet — AuthProvider shows CompleteProfileModal while this is false.
  profileCompleted?: boolean;
  // Account-level visibility. Undefined/false = public. When true, new
  // followers must be accepted via a follow request (see FriendsScreen).
  isPrivate?: boolean;
  // extend with domain-specific fields
}

// Row shape shared by the Friends screen's Followers/Following/Search/
// Suggested/Requests tabs — mirrors the backend's UserCardResponse exactly.
export type FollowRelationship = 'NONE' | 'PENDING' | 'ACCEPTED' | 'SELF';

export interface UserCard {
  firebaseUid: string;
  displayName: string;
  profileImageUrl?: string;
  sports?: string[];
  skillLevel?: string;
  relationshipStatus: FollowRelationship;
  distanceKm?: number;
  requestedAt?: string;
}

// Mirrors the backend's PostResponse exactly - the shape every screen that
// renders a post (Feed, my Profile, a friend's Profile) works with.
export interface PostSummary {
  id: string;
  authorId: string;
  authorDisplayName: string;
  authorProfileImageUrl?: string;
  caption?: string;
  mediaUrl?: string;
  sport?: string;
  // 'PROFILE_PICTURE_UPDATE' for the auto-generated "updated their profile
  // picture" post (see backend SocialService.createProfilePictureUpdatePost);
  // absent/'NORMAL' for a regular post.
  postType?: 'NORMAL' | 'PROFILE_PICTURE_UPDATE';
  likeCount: number;
  commentCount: number;
  likedByCurrentUser: boolean;
  savedByCurrentUser: boolean;
  createdAt: string;
  updatedAt?: string;
}

// Mirrors the backend's CommentResponse - a comment is either text or a GIF.
export interface CommentItem {
  id: string;
  postId: string;
  firebaseUid: string;
  displayName: string;
  profileImageUrl?: string;
  content?: string;
  gifUrl?: string;
  createdAt: string;
}

export interface ReelSummary {
  id: string;
  authorId: string;
  authorDisplayName: string;
  authorProfileImageUrl?: string;
  caption?: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  filterName?: string;
  captionText?: string;
  captionColor?: string;
  captionX?: number;
  captionY?: number;
  emoji?: string;
  emojiX?: number;
  emojiY?: number;
  audioTrackUrl?: string;
  audioVolume?: number;
  likeCount: number;
  likedByCurrentUser: boolean;
  viewCount: number;
  createdAt: string;
}

export interface CompleteProfilePayload {
  sports: string[];
  referralCode?: string;
}

export type CreatePostPayload = {
  caption: string;
  media: any;
  sport: string;
  taggedUsers?: string[];
  latitude?: number;
  longitude?: number;
  locationName?: string;
  visibility?: 'public' | 'private';
};

export interface MatchOrganizer {
  id: string;
  name: string;
  avatarUrl?: string;
  rating?: number;
  matchesPlayed?: number;
}

export interface MatchParticipant {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface MatchVenue {
  id?: string;
  name: string;
  address?: string;
  postcode?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  amenities?: string[];
}

// Shape actually returned by the Spring Boot backend's BookingResponse DTO
// (com.pasxo.dto.booking.BookingResponse). This is a single futsal-slot
// booking owned by the authenticated user - there is no multi-player
// "match" concept (organizer/participants/payment) on the backend yet.
// PENDING_VENDOR — created, awaiting venue acceptance (only organizer can see)
// ACTIVE_MATCH   — venue accepted, visible to everyone in nearby/search
// PENDING        — legacy alias for PENDING_VENDOR used by older backend versions
// CONFIRMED      — legacy alias for ACTIVE_MATCH used by older backend versions
export type BackendBookingStatus =
  | 'PENDING_VENDOR'
  | 'ACTIVE_MATCH'
  | 'PENDING'
  | 'CONFIRMED'
  | 'CANCELLED';

export interface BookingRecord {
  id: number;
  userId: string;
  futsalId: number;
  futsalName: string;
  slotId: number;
  slotDate: string; // e.g. "2026-06-16"
  startTime: string; // e.g. "18:00:00"
  endTime: string; // e.g. "19:00:00"
  status: BackendBookingStatus;
  bookedAt: string;
  title?: string;
  maxPlayers?: number;
  minPlayers?: number;
  joinedPlayersCount?: number;
  players?: string[];
  vendorStatus?: 'PENDING_VENDOR' | 'ACTIVE_MATCH';
  rejectionReason?: string;
}

// UI-facing model used by MatchDetailsScreen/CheckoutScreen/BookingStatusScreen.
// Built from BookingRecord by parseMatchDetails(). Fields the backend doesn't
// expose yet (organizer, participants, pricing, amenities, rules, images...)
// are left undefined or given a generic placeholder, and are wired up for
// real once the backend adds the corresponding attribute.
// Mirrors the backend's MatchScoreResponse exactly (com.pasxo.dto.booking.MatchScoreResponse).
export type MatchLiveStatus = 'NOT_STARTED' | 'LIVE' | 'PAUSED' | 'COMPLETED';

export interface MatchScoreState {
  bookingId: number;
  sport: string;
  status: MatchLiveStatus;
  teamAScore: number;
  teamBScore: number;
  state: Record<string, any>;
  timerRunning: boolean;
  timerStartedAt?: string | null;
  elapsedSeconds: number;
  updatedAt?: string | null;
  canScore: boolean;
}

export interface MatchDetails {
  id: string;
  futsalId?: number;
  slotId?: number;
  slotIds?: number[];
  matchCode?: string;
  title: string;
  sportType: string;
  format?: string;
  level?: string;
  images?: string[];
  startDate?: string;
  endDate?: string;
  venue: MatchVenue;
  organizer?: MatchOrganizer;
  participants?: MatchParticipant[];
  maxSpots?: number;
  minPlayers?: number;
  spotsLeft?: number;
  joinedPlayers?: number;
  pricePerSlot?: number;
  slotCount?: number;
  pricePerPlayer?: number;
  serviceFeePercent?: number;
  totalPrice?: number;
  currencySymbol?: string;
  rules?: string[];
  description?: string;
  bookingConfirmed?: boolean;
  pitchLabel?: string;
  creatorId?: string;
  status?: BackendBookingStatus;
  vendorStatus?: 'PENDING_VENDOR' | 'ACTIVE_MATCH';
  rejectionReason?: string;
  bookedAt?: string;
  // Mirrors backend BookingResponse.paymentStatus — used to know whether cancelling
  // will actually trigger a refund (NOT_APPLICABLE = free/walk-in booking, nothing to refund).
  paymentStatus?: 'NOT_APPLICABLE' | 'AWAITING_PAYMENT' | 'PAID' | 'PAYMENT_FAILED' | 'REFUND_PENDING' | 'REFUNDED';
  // Mirrors backend BookingResponse.isWithinCancellationWindow — false once the booking
  // is within 48h of kickoff (for bookings longer than 1h), matching BookingService's
  // enforceCancellationWindow rule server-side. Drives whether Cancel Booking is shown.
  isWithinCancellationWindow?: boolean;
  // Organizer + every paying joiner, mirrors backend BookingResponse.paidParticipants.
  paidParticipants?: number;
}

export interface CreateBookingPayload {
  futsalId: number;
  slotId: number;
  slotIds: number[];
  title?: string;
  sport?: string;
  maxPlayers?: number;
  minPlayers?: number;
  /** true (default) = discoverable in public search/discovery; false = invitees-only. */
  isPublic?: boolean;
  players?: string[];
}

// ---------------------------------------------------------------------------
// Payments (PayHere) — mirrors com.pasxo.dto.payment.* / dto.enums.PaymentOrderType
// exactly. BOOKING and MATCH_JOIN are wired up on the backend so far.
// ---------------------------------------------------------------------------

export type PaymentOrderType =
  | 'BOOKING'
  // Paying to join someone else's match — orderId is a MatchJoinOrder id (see backend),
  // NOT a MatchInvitation id and NOT a bookingId. Always obtained from either
  // AcceptInvitationResponse.paymentOrderId or JoinOrderResponse.paymentOrderId.
  | 'MATCH_JOIN'
  | 'TRAINER_BOOKING'
  | 'SUBSCRIPTION'
  | 'ONE_TIME_CREATION'
  | 'ANNOUNCEMENT';

export type PaymentTransactionStatus =
  | 'INITIATED'
  | 'PENDING_GATEWAY'
  | 'CHARGED'
  | 'CONFIRMED'
  | 'FAILED'
  | 'EXPIRED'
  | 'REFUND_REQUESTED'
  | 'REFUNDED'
  | 'REFUND_FAILED';

// Everything the PayHere JS SDK's payhere.startPayment(...) call needs.
// merchant_secret is never part of this — only the backend-computed hash is.
export interface CheckoutInitiationResponse {
  transactionId: number;
  merchantId: string;
  merchantOrderId: string;
  amount: string; // "0.00" formatted — must be passed through unchanged, the hash was computed over this exact string
  currency: string;
  items: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  notifyUrl: string;
  returnUrl: string;
  cancelUrl: string;
  hash: string;
  sandbox: boolean;
  // Backend-rendered checkout page reachable through the tunnel/domain — the
  // WebView loads this URL directly rather than building HTML inline, since
  // PayHere's JS SDK checks the calling page's real origin against the
  // domain/app the Merchant Secret was issued for.
  checkoutPageUrl: string;
  // True when the backend's payment.dummy-mode bypassed PayHere and already
  // charged the transaction — the app must not open the checkout WebView in
  // this case (see PayHereCheckoutPageController's doc comment on the backend).
  dummyMode: boolean;
}

export interface PaymentStatusResponse {
  transactionId: number;
  orderType: PaymentOrderType;
  orderId: number;
  status: PaymentTransactionStatus;
  amount: number;
  currency: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Tournaments
// ---------------------------------------------------------------------------
// Shapes below mirror com.pasxo.dto.booking.Tournament*Response exactly.
// The backend supports: create/list/get tournament, create/list teams,
// add/list team players, create/list matches. There is NO endpoint to
// update a match score or to transition tournament/match status - those
// fields exist on the backend entities (teamAScore/teamBScore, status) but
// nothing writes to them yet. The frontend manages scoring + a richer
// lifecycle locally (see src/utils/tournamentStorage.ts) until the backend
// adds real persistence, while still trying the real REST call first so it
// upgrades automatically the day that endpoint exists.

export interface TournamentRecord {
  id: number;
  futsalId: number;
  name: string;
  description?: string;
  date: string; // LocalDate, e.g. "2026-06-20"
  createdBy: string; // firebaseUid of the creator
  status: string; // backend always sends "ACTIVE" today
  slotIds: number[];
}

export interface TournamentTeamRecord {
  id: number;
  name: string;
  playerCount: number;
}

export interface TournamentPlayerRecord {
  id: number;
  playerFirebaseUid: string;
  playerDisplayName?: string;
  playerEmail?: string;
}

export type TournamentMatchStatus = 'SCHEDULED' | 'LIVE' | 'COMPLETED';

export interface TournamentMatchRecord {
  id: number;
  teamAId: number;
  teamBId: number;
  slotId?: number;
  slotDate?: string;
  startTime?: string;
  endTime?: string;
  status: string; // backend always sends "SCHEDULED" today
  teamAScore?: number;
  teamBScore?: number;
}

// Request payloads - match com.pasxo.dto.booking.Tournament*Request exactly.
export interface CreateTournamentPayload {
  name: string;
  description?: string;
  date: string; // ISO date "2026-06-20"
  slotIds?: number[];
}

export interface CreateTournamentTeamPayload {
  name: string;
}

export interface AddTournamentPlayerPayload {
  playerFirebaseUid: string;
}

export interface CreateTournamentMatchPayload {
  teamAId: number;
  teamBId: number;
  slotId?: number;
}

// UI-facing, enriched models used by the tournament screens. team/player
// flair (color, emoji) is generated client-side purely for presentation.
export interface TournamentTeamUI extends TournamentTeamRecord {
  players: TournamentPlayerRecord[];
  color: string;
  emoji: string;
}

export interface TournamentMatchUI extends TournamentMatchRecord {
  teamA?: TournamentTeamUI;
  teamB?: TournamentTeamUI;
  // Derived client-side from the local score/status cache, not the backend.
  derivedStatus: TournamentMatchStatus;
}

export type TournamentLifecycle = 'UPCOMING' | 'LIVE' | 'COMPLETED';

export interface TournamentUI extends TournamentRecord {
  venueName?: string;
  teams: TournamentTeamUI[];
  matches: TournamentMatchUI[];
  isOwner: boolean;
  // Derived client-side from match completion / date, not the backend's
  // static "ACTIVE" status.
  lifecycle: TournamentLifecycle;
}

// ─── Trainer domain — mirrors mobile-app-paasxo's dto.trainer.* responses exactly ──

export type TrainerCategory =
  | 'GYM' | 'CALISTHENICS' | 'DANCING' | 'YOGA' | 'CROSSFIT' | 'MARTIAL_ARTS' | 'PILATES' | 'OTHER';

export interface TrainerProfile {
  id: number;
  trainerFirebaseUid: string;
  trainerDisplayName?: string;
  trainerAvatarUrl?: string;
  categories: TrainerCategory[];
  bio?: string;
  certifications?: string;
  experienceYears?: number;
  hourlyRate?: number;
  profileImageUrl?: string;
  coverImageUrl?: string;
  galleryImageUrls?: string[];
  location?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  active: boolean;
  distanceKm?: number;
  sessionCount?: number;
}

export type DayOfWeekName =
  | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface TrainerSession {
  id: number;
  trainerFirebaseUid: string;
  trainerDisplayName?: string;
  trainerAvatarUrl?: string;
  title: string;
  category: TrainerCategory;
  description?: string;
  location?: string;
  isOnline: boolean;
  latitude?: number;
  longitude?: number;
  price: number;
  durationMinutes: number;
  capacity: number;
  daysOfWeek: DayOfWeekName[];
  startTime: string; // "HH:mm:ss"
  planDetails?: string;
  imageUrl?: string;
  active: boolean;
}

export type TrainerSessionSlotStatus = 'OPEN' | 'FULL' | 'CANCELLED';

export interface TrainerSessionSlot {
  id: number;
  trainerSessionId: number;
  slotDate: string; // "YYYY-MM-DD"
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  spotsLeft: number;
  status: TrainerSessionSlotStatus;
}

export type TrainerBookingStatus = 'CONFIRMED' | 'CANCELLED';

export interface TrainerBooking {
  id: number;
  userId: string;
  userDisplayName?: string;
  userAvatarUrl?: string;
  slotId: number;
  sessionId: number;
  sessionTitle: string;
  trainerFirebaseUid: string;
  trainerDisplayName?: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  status: TrainerBookingStatus;
  pricePaid?: number;
  bookedAt: string;
}
