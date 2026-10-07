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
  // 'USER' (Personal Account) or 'VENDOR' (Service Provider) — see
  // AuthService#register on the backend, which already fully supports both;
  // VENDOR accounts go through manual admin verification before they can
  // log in (see PendingVerification handling in SignUpScreen/PostVerificationScreen).
  accountType?: 'USER' | 'VENDOR';
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
  // WALK/RUN/CYCLING subset hidden from non-owner viewers of this user's
  // profile Stats tab — see SettingsScreen's Stats Visibility toggles and
  // ActivityService#getUserSummary (backend) which enforces it.
  hiddenStatsActivityTypes?: string[];
  // 'USER' | 'VENDOR' | 'TRAINER' | 'ADMIN' — see AccountType.java. Checked
  // right after registration to route a pending VENDOR sign-up to
  // PostVerificationScreen's "under review" state instead of "welcome in".
  accountType?: string;
  // False only for a VENDOR account still awaiting admin verification (see
  // AuthService#assertVendorActive) — true for every other account type.
  active?: boolean;
  // Optional, user-entered on EditProfileScreen. Enables a real per-user
  // calorie estimate on Activity sessions (see activityMath.ts's
  // calcCalories) — undefined means "not provided", which leaves calories
  // off entirely rather than showing a number that isn't tied to the
  // user's actual body weight.
  weightKg?: number;
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
  thumbnailUrl?: string;
  sport?: string;
  // 'PROFILE_PICTURE_UPDATE' for the auto-generated "updated their profile
  // picture" post (see backend SocialService.createProfilePictureUpdatePost);
  // 'TOURNAMENT_CREATED' for an open-tournament announcement (see
  // createTournamentAnnouncementPost, referenceId is the tournament id);
  // 'COMMUNITY_POST'/'COMMUNITY_*_SHARE' for a post living inside a
  // Community (see communityApi.ts) — referenceId is the shared match/
  // tournament/reel id for the SHARE variants; absent/'NORMAL' for a
  // regular profile/feed post.
  postType?: 'NORMAL' | 'PROFILE_PICTURE_UPDATE' | 'TOURNAMENT_CREATED'
    | 'COMMUNITY_POST' | 'COMMUNITY_MATCH_SHARE' | 'COMMUNITY_TOURNAMENT_SHARE'
    | 'COMMUNITY_SCORECARD_SHARE' | 'COMMUNITY_REEL_SHARE';
  referenceId?: string;
  // Non-null only for a post living inside a Community's feed.
  communityId?: string;
  visibility?: 'public' | 'friends' | 'private';
  // 'VIDEO' opens PostVideoPlayer (Reels-style fullscreen) instead of the
  // inline <Image>; absent/'IMAGE' renders as a normal photo post.
  mediaType?: 'IMAGE' | 'VIDEO';
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

// Mirrors the backend's ReportTargetType / ReportReason enums exactly (see
// com.pasxo.dto.enums on the backend) - required by App Store Review
// Guideline 1.2 (User Generated Content).
export type ReportTargetType = 'POST' | 'COMMENT' | 'USER';

export type ReportReason =
  | 'SPAM'
  | 'HARASSMENT_OR_BULLYING'
  | 'HATE_SPEECH'
  | 'NUDITY_OR_SEXUAL_CONTENT'
  | 'VIOLENCE_OR_DANGEROUS_ACTS'
  | 'FALSE_INFORMATION'
  | 'OTHER';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'HARASSMENT_OR_BULLYING', label: 'Harassment or bullying' },
  { value: 'HATE_SPEECH', label: 'Hate speech' },
  { value: 'NUDITY_OR_SEXUAL_CONTENT', label: 'Nudity or sexual content' },
  { value: 'VIOLENCE_OR_DANGEROUS_ACTS', label: 'Violence or dangerous acts' },
  { value: 'FALSE_INFORMATION', label: 'False information' },
  { value: 'OTHER', label: 'Something else' },
];

export interface CreateReportPayload {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
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
  visibility?: 'public' | 'friends' | 'private';
  mediaType?: 'IMAGE' | 'VIDEO';
  // Required alongside media when mediaType is 'VIDEO' - a still frame
  // extracted client-side (expo-video-thumbnails) so a video post can show a
  // real preview instead of a blank tile before it's ever played.
  thumbnail?: any;
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
  teamAName: string;
  teamBName: string;
  state: Record<string, any>;
  timerRunning: boolean;
  timerStartedAt?: string | null;
  elapsedSeconds: number;
  updatedAt?: string | null;
  canScore: boolean;
}

// ─── Match-day team rosters & scoring events ───────────────────────────────
// Mirrors com.pasxo.dto.booking.{MatchTeamPlayerResponse,MatchTeamsResponse,
// MatchScoreEventResponse,MatchScorecardResponse} exactly.

export interface MatchTeamPlayer {
  // null for an "unassigned joined player" suggestion row — not yet a real
  // roster entry, so there's nothing to reference by id/team yet.
  id?: number | null;
  teamLabel?: string | null;
  playerFirebaseUid?: string | null;
  displayName: string;
  profileImageUrl?: string | null;
}

export interface MatchTeams {
  teamAName: string;
  teamBName: string;
  teamA: MatchTeamPlayer[];
  teamB: MatchTeamPlayer[];
  unassignedJoinedPlayers: MatchTeamPlayer[];
  canManage: boolean;
}

export type MatchEventType = 'GOAL' | 'ASSIST' | 'YELLOW_CARD' | 'RED_CARD' | 'SAVE' | 'POINT' | 'BALL';
export type WicketType = 'BOWLED' | 'CAUGHT' | 'LBW' | 'RUN_OUT' | 'STUMPED' | 'HIT_WICKET' | 'OTHER';
export type ExtraType = 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE';

export interface MatchScoreEvent {
  id: number;
  teamLabel: 'A' | 'B';
  eventType: MatchEventType;
  playerId?: number | null;
  playerName?: string | null;
  minute?: number | null;
  inningsNumber?: number | null;
  overNumber?: number | null;
  ballInOver?: number | null;
  runs?: number | null;
  legalDelivery?: boolean | null;
  isWicket?: boolean | null;
  wicketType?: WicketType | null;
  extraType?: ExtraType | null;
  bowlerId?: number | null;
  bowlerName?: string | null;
  sequenceNumber: number;
  createdAt: string;
}

export interface MatchPlayerTally {
  playerId: number;
  playerName: string;
  teamLabel: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  saves: number;
  points: number;
}

export interface MatchBattingFigure {
  playerId: number;
  playerName: string;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  out: boolean;
  howOut?: string | null;
}

export interface MatchBowlingFigure {
  playerId: number;
  playerName: string;
  completedOvers: number;
  ballsInCurrentOver: number;
  runsConceded: number;
  wickets: number;
}

export interface MatchInningsSummary {
  inningsNumber: number;
  battingTeamLabel: string;
  runs: number;
  wickets: number;
  overs: number;
  ballsInOver: number;
  batting: MatchBattingFigure[];
  bowling: MatchBowlingFigure[];
}

export interface MatchScorecard {
  sport: string;
  teamAName: string;
  teamBName: string;
  teamAScore: number;
  teamBScore: number;
  teamA: MatchTeamPlayer[];
  teamB: MatchTeamPlayer[];
  events: MatchScoreEvent[];
  scorers?: MatchPlayerTally[];
  innings?: MatchInningsSummary[];
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
  /** Opt-in open-join mode with a flat platform fee — see CreateBookingPayload.isPublicMatch. */
  isPublicMatch?: boolean;
  /** Only set when isPublicMatch is true — the flat fee (LKR) a joiner pays on top of their venue-cost share. */
  publicMatchJoinFee?: number;
  // True for a match held at a user-picked public space rather than a real
  // booked venue — venue.name/location still carry the real custom name/
  // coordinates (see BookingResponse.isPublicSpaceMatch's own doc comment).
  // Used purely for presentation (e.g. a "Public Space" badge instead of a
  // venue card) — payment/booking logic is identical either way.
  isPublicSpaceMatch?: boolean;
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
  // Set only for a Team Match Challenge booking — see backend
  // BookingResponse.organizerTeamId's doc comment. Both omitted for every
  // ordinary match.
  organizerTeamId?: string;
  opponentTeamId?: string;
}

export interface CreateBookingPayload {
  // Required for a normal venue booking; omitted entirely for a Public Match
  // (isPublicSpaceMatch=true below) — the backend creates its own one-off
  // venue/slot for those instead.
  futsalId?: number;
  slotId?: number;
  slotIds?: number[];
  title?: string;
  description?: string;
  sport?: string;
  maxPlayers?: number;
  minPlayers?: number;
  /** true (default) = discoverable in public search/discovery; false = invitees-only. */
  isPublic?: boolean;
  /**
   * Distinct from isPublic above (which is only about search discoverability
   * and free) — an opt-in "Public Match" mode where anyone can join directly,
   * no invitation needed, for a flat platform fee on top of the venue-cost
   * split. Defaults false: an ordinary match is never silently charged this.
   */
  isPublicMatch?: boolean;
  players?: string[];

  // Public Match — a match held at a user-picked public space instead of a
  // real booked venue, for a flat PAASXO fee (see PlatformProperties.
  // publicSpaceMatchFee, currently LKR 300). When true, futsalId/slotId(s)
  // above are ignored by the backend; the fields below are required instead.
  // Distinct from isPublicMatch above (that's an add-on mode for an ordinary
  // VENUE booking, unrelated to this).
  isPublicSpaceMatch?: boolean;
  publicSpaceName?: string;
  publicSpaceLatitude?: number;
  publicSpaceLongitude?: number;
  /** "YYYY-MM-DD" — reuses the same `date` concept as a venue booking's slot date. */
  date?: string;
  /** "HH:mm" — only used when isPublicSpaceMatch is true. */
  startTime?: string;
  endTime?: string;
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
  | 'ANNOUNCEMENT'
  // The challenged team's captain paying half of a Team Match Challenge's
  // totalPrice to accept it — orderId is a TeamChallengeAcceptOrder id (see
  // backend's doc comment on that entity). See TeamChallengePaymentListener.
  | 'TEAM_CHALLENGE_ACCEPT';

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
  // Defaults to invite-only (false) on the backend when omitted. An open
  // tournament is discoverable and announces itself to the organizer's
  // followers via the feed (see SocialService.createTournamentAnnouncementPost).
  isOpen?: boolean;
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

// ─── Team domain — mirrors mobile-app-paasxo's dto.team.* responses exactly ──
// A persistent, cross-tournament, cross-match social Team (create once,
// captain manages the roster, teams can challenge each other). Deliberately
// distinct from TournamentTeamRecord above, which only ever exists scoped
// inside a single Tournament - the two are unrelated and not convertible.

export interface TeamMemberSummary {
  firebaseUid: string;
  displayName: string;
  profileImageUrl?: string;
  captain: boolean;
}

export interface Team {
  id: string;
  name: string;
  logoUrl?: string;
  sport: string; // com.pasxo.dto.enums.Sport
  captainFirebaseUid: string;
  members: TeamMemberSummary[];
  createdAt: string;
  updatedAt: string;
}

export type ChallengeStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export interface TeamChallenge {
  id: string;
  challengerTeamId: string;
  challengerTeamName?: string;
  challengedTeamId: string;
  challengedTeamName?: string;
  challengerFirebaseUid: string;
  status: ChallengeStatus;
  message?: string;
  createdAt: string;
  updatedAt: string;
}

// Request payloads - match com.pasxo.dto.team.* exactly.
export interface CreateTeamPayload {
  name: string;
  sport: string;
  logoUrl?: string;
  logo?: { uri: string; name?: string; type?: string };
  // Best-effort device GPS captured silently at creation time — see
  // CreateTeamScreen. Used only for "nearby teams" in Team Match Challenges;
  // both omitted if location permission was denied.
  latitude?: number;
  longitude?: number;
}

export interface SendChallengePayload {
  challengerTeamId: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Team Match Challenges — real, bookable Team-vs-Team matches, distinct from
// the purely social TeamChallenge/ChallengeStatus above. Mirrors
// com.pasxo.dto.team.TeamMatchChallengeResponse / TeamMatchChallengeStatus.
// ---------------------------------------------------------------------------

export type TeamMatchChallengeStatus = 'PENDING_PAYMENT' | 'ACCEPTED' | 'DECLINED';

export interface TeamMatchChallenge {
  id: string;
  bookingId: number;
  organizerTeamId: string;
  organizerTeamName?: string;
  challengedTeamId: string;
  challengedTeamName?: string;
  status: TeamMatchChallengeStatus;
  totalPrice: number;
  amountDue: number;
  createdAt: string;
  respondedAt?: string;
}
