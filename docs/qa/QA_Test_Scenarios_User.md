# Paasxo — Normal User App QA Test Scenarios

**App under test:** `Paasxo-main` (Expo/React Native), logged in as an account with `accountType = USER`
**Backend:** `mobile-app-paasxo` (Spring Boot), shared with the Vendor App (Vendor + Trainer roles)
**Companion documents:** `QA_Test_Scenarios_Vendor.md`, `QA_Test_Scenarios_Trainer.md`

---

## 1. Scope

This is the customer-facing app: browsing and booking venues for matches, creating/managing tournaments, booking personal-trainer sessions, and a social layer (feed, posts, reels, stories, follow/friends, chat, notifications). This document covers every screen reachable by a normal User account, using **5 dummy users** so social interactions (follow requests, invites, joins, direct-adds, tournament teams) can be tested realistically between real accounts. It also includes negative tests and references to the cross-app integration scenarios already detailed from the other side in `QA_Test_Scenarios_Vendor.md` (Module 13) and `QA_Test_Scenarios_Trainer.md` (Module 12).

---

## 2. Test Data — Dummy Accounts (use these exact values across all 3 test documents for consistency)

### Normal Users (5)

| User | Email | Password | Phone | Notes |
|---|---|---|---|---|
| User 1 | Ashan Perera | `ashan.user@paasxotest.com` | +94 77 111 0001 | Public account. Primary match organizer. Subscribes to Pro (used for scoring + trainer-join tests). |
| User 2 | Dilshan Silva | `dilshan.user@paasxotest.com` | +94 77 111 0002 | Public account. Joins matches, plays on tournament teams. |
| User 3 | Nadeesha Fernando | `nadeesha.user@paasxotest.com` | +94 77 111 0003 | Public account. Creates and manages a tournament. |
| User 4 | Chamara Jayasuriya | `chamara.user@paasxotest.com` | +94 77 111 0004 | Public account. Books trainer sessions; also subscribes to Pro. |
| User 5 | Ishara Rajapaksa | `ishara.user@paasxotest.com` | +94 77 111 0005 | **Sets account to Private** (Settings → Private Account) specifically to exercise the follow-request approval flow. |

All 5 register with sport preference **Futsal**, password `Test@1234`.

### Supporting accounts (from the other two documents, needed for cross-app tests)
- Vendors: **Nimal Perera / Colombo Sports Hub, Saman Kumara / Kandy Kickers Arena, Ruwani Silva / Galle Sports Zone** — each with 2 branches (see `QA_Test_Scenarios_Vendor.md`, Section 2).
- Trainers: **Kasun Fernando (Gym/CrossFit), Dilani Wijesekara (Yoga/Pilates), Roshan Silva (Martial Arts/Calisthenics)** — each with 2 sessions (see `QA_Test_Scenarios_Trainer.md`, Section 2).

Run the Vendor and Trainer setup scenarios (venue/branch creation + slot generation; trainer profile/session creation + availability generation) **before** starting Modules 4, 5, and 7 of this document, since match booking and trainer booking both require real venues/sessions to already exist.

---

## 3. Legend

- **Priority:** High (core money/social path) / Medium / Low
- Screen names and button/field labels are quoted exactly as they appear in the UI.
- **[Known behavior]** marks a result that looks unusual but is confirmed intentional or a confirmed stub — do not log these as new bugs.
- **[Confirmed bug]** marks something confirmed broken in the code that should be actively verified and logged if reproduced.
- **[Confirmed gap]** marks a missing feature worth confirming/logging.

---

## 4. Module 1 — Onboarding & Authentication

**TC-USR-001 | Priority: Medium | Welcome screen swipe-through**
1. Launch the app for the first time (logged out) → **Welcome** screen.
2. Swipe through all 4 slides (Discover / Join teams / Track journey / Connect).
- **Expected:** Slides transition smoothly; **Skip** (top) always goes to `/sign-in`; bottom **"Get Started"** goes to `/sign-up`.

**TC-USR-002 | Priority: High | Register User 1 — Ashan Perera**
1. From Welcome, tap **"Get Started"** → **Sign Up**.
2. Tap the avatar circle → pick a profile photo from gallery.
3. Fill: Full Name = `Ashan Perera`, Email = `ashan.user@paasxotest.com`, Phone Number = `+94 77 111 0001`, Password = `Test@1234`, Confirm Password = `Test@1234`.
4. Under **"SELECT YOUR ACTIVITY"**, select chip **Futsal**.
5. Leave **"REFERRAL CODE (OPTIONAL)"** blank.
6. Tap **"Finish Setup"**.
- **Expected:** Navigates to **Post-Verification** screen ("Account Verified!" celebratory animation) → tap **"Get Started"** → lands on **Home**.

**TC-USR-003 | Priority: High | Register Users 2–5**
- Repeat TC-USR-002 for Dilshan Silva, Nadeesha Fernando, Chamara Jayasuriya, and Ishara Rajapaksa using the data table above.
- **Expected:** Each registers independently and lands on their own Home feed.

**TC-USR-004 | Priority: Medium | Validation — invalid email format**
1. On Sign Up, enter `ashan.user` (no domain) → attempt **"Finish Setup"**.
- **Expected:** Blocking validation error.

**TC-USR-005 | Priority: Medium | Validation — phone number too short**
1. Enter a phone number under 7 digits → submit.
- **Expected:** Blocking validation error.

**TC-USR-006 | Priority: Medium | Validation — password under 8 characters**
1. Enter a 6-character password → submit.
- **Expected:** Blocking validation error (Sign Up requires ≥8 chars, stricter than the vendor-app's ≥6).

**TC-USR-007 | Priority: Medium | Validation — confirm password mismatch**
1. Enter Password ≠ Confirm Password → submit.
- **Expected:** Blocking validation error.

**TC-USR-008 | Priority: Low | Referral code field accepts optional input**
1. Register a test account with Referral Code = `PAASXO_2024` filled in.
- **Expected:** Registration succeeds; no error whether the code is valid or not (verify whether an invalid code is silently ignored or rejected — document actual behavior).

**TC-USR-009 | Priority: Medium | Duplicate email registration**
1. Attempt to register again with `ashan.user@paasxotest.com` (already used).
- **Expected:** Server error surfaced to the user; no duplicate account created.

**TC-USR-010 | Priority: High | Sign in with valid credentials**
1. On **Sign In**, enter `ashan.user@paasxotest.com` / `Test@1234` → tap **"Sign In"**.
- **Expected:** Navigates directly to **Home** (`router.replace`, no back-navigation to sign-in).

**TC-USR-011 | Priority: Medium | Sign in with wrong password / unregistered email**
1. Try an incorrect password, then an unregistered email.
- **Expected:** Both fail with a clear on-screen error; user remains on Sign In.

**TC-USR-012 | Priority: Low | Password visibility toggle (eye icon)**
1. On Sign In, type a password, tap the eye icon.
- **Expected:** Toggles between masked and plain text correctly.

**TC-USR-013 | Priority: Medium | Forgot Password — request reset link**
1. From Sign In, tap **"FORGOT?"** → **Forgot Password** screen.
2. Enter `ashan.user@paasxotest.com` → tap **"Send Reset Link"**.
- **Expected:** Screen transitions to the "sent" step ("Check Your Inbox") — note this always shows success even for unregistered emails (by design, to prevent email enumeration), so this alone doesn't confirm an email was actually sent; cross-check the inbox for a real account.

**TC-USR-014 | Priority: Low | Forgot Password — "Try a different email"**
1. From the "sent" step, tap **"Try a different email"**.
- **Expected:** Returns to the email-input step with the field cleared.

**TC-USR-015 | Priority: Low | Forgot Password — "Back to Login"**
1. From the "sent" step, tap **"Back to Login"**.
- **Expected:** Returns to Sign In.

**TC-USR-016 | Priority: High | Apple Sign-In is non-functional**
1. On Sign Up or Sign In, tap **"Continue with Apple"**.
- **Expected: [Confirmed bug/gap]** — the button calls the sign-in flow with an empty token string; no native Apple auth sheet appears. Confirm it fails silently or shows an error rather than falsely succeeding — if it ever appears to log a user in, escalate immediately as a security-relevant defect.

**TC-USR-017 | Priority: High | Google Sign-In — new account, complete-profile modal appears**
1. On Sign Up, tap **"Continue with Google"** and complete the Google auth flow with a Google account never used on Paasxo before.
- **Expected:** Account is created server-side as `accountType = USER` (Google sign-up can never create a Vendor/Trainer account — confirms backend behavior). Lands on Home, and the **Complete Profile** modal appears automatically (not dismissible via a close button) — title "Almost there, {FirstName}!".

**TC-USR-018 | Priority: Medium | Complete Profile modal — required before continuing**
1. Continuing from TC-USR-017, try to dismiss the modal without filling it in (check for any close/X control).
- **Expected:** No dismiss control exists — user must either complete it or use **"Sign out instead"**.

**TC-USR-019 | Priority: Medium | Complete Profile modal — submit**
1. Under "SELECT YOUR ACTIVITY", select **Futsal**; optionally enter a referral code.
2. Tap **"Complete Setup"**.
- **Expected:** Modal closes; `profileCompleted` becomes true; modal does not reappear on subsequent app opens.

**TC-USR-020 | Priority: Medium | Complete Profile modal — "Sign out instead"**
1. Reopen the modal state (new Google account) → tap **"Sign out instead"**.
- **Expected:** Logs out and returns to Sign In without completing the profile.

**TC-USR-021 | Priority: Medium | Google Sign-In — existing account, no complete-profile modal**
1. Sign out, then Sign In again using the same Google account from TC-USR-017/019.
- **Expected:** Goes straight to Home; Complete Profile modal does NOT reappear (profile already completed).

**TC-USR-022 | Priority: Low | Session persistence across app restart**
1. Sign in as User 1 → force-close → reopen the app.
- **Expected:** Restores session automatically, landing on Home without re-prompting login.

---

## 5. Module 2 — Home, Navigation & Explore

**TC-USR-023 | Priority: High | Bottom navbar — all 4 tabs + center FAB route correctly**
1. From any screen, tap **FEED**, then **EXPLORE**, then **FRIENDS**, then **PROFILE**.
- **Expected:** Routes to `/feed`, `/home`, `/friends`, `/profile` respectively, each with the correct tab visually highlighted.

**TC-USR-024 | Priority: Medium | Center FAB — options differ by active tab (Explore)**
1. While on the Explore/Home tab, tap the center **"+"** FAB.
- **Expected:** Bottom sheet "Let's get started 🎉" shows **"Create Match"** and **"Create Tournament"** options.

**TC-USR-025 | Priority: Medium | Center FAB — options differ by active tab (Feed)**
1. While on the Feed tab, tap the center **"+"** FAB.
- **Expected:** Bottom sheet shows **"Create Post"**, **"Create Reel"**, **"Create Story"** instead.

**TC-USR-026 | Priority: Low | FAB is hidden on Friends/Profile tabs**
1. Navigate to Friends, then Profile; check for the center FAB.
- **Expected:** FAB does not appear on these two tabs.

**TC-USR-027 | Priority: High | Home header greeting and notification bell**
1. Sign in as Ashan at different times of day (or check code logic) — greeting should read "Good morning/afternoon/evening/night, Ashan".
2. Trigger a GENERAL notification (e.g. from any cross-app flow), check the bell badge, tap it.
- **Expected:** Greeting matches time of day; badge shows correct unread GENERAL count; tapping opens **Notifications**.

**TC-USR-028 | Priority: Medium | Home search bar and filter icon**
1. On Home, tap the search bar ("Find games, venues, coaches…") → type a query.
2. Tap the filter icon.
- **Expected:** Filter icon navigates to `/explore`; verify search bar behavior (either filters locally or also routes to Explore — document actual behavior).

**TC-USR-029 | Priority: Medium | Sport filter chips on Home**
1. Tap each chip: Futsal, Cricket, Pickleball, Paddleball, Trainer, Walk/Run.
- **Expected:** Content in the active tab (Matches/Tournaments/Trainer/Walk-Run) filters accordingly without crashing.

**TC-USR-030 | Priority: High | Home 4-way segment — Matches tab, "Nearby"**
1. On Home's Matches tab, select segment **"Nearby"**.
- **Expected:** Shows ACTIVE_MATCH bookings near the device's location (or default region), each with sport tag, vendor status badge, price/player, date, spots, and a **"Join Game"**/**"Already Joined"**/**"View details"** button.

**TC-USR-031 | Priority: High | Home Matches — "My Bookings" segment**
1. Select segment **"My Bookings"** as Ashan after creating at least one match (Module 4).
- **Expected:** Shows only matches Ashan organized, including ones still PENDING_VENDOR (shown with the "⏳ Pending Venue" badge).

**TC-USR-032 | Priority: High | Home Matches — "Joined" segment**
1. Select segment **"Joined"** as a user who has joined someone else's match.
- **Expected:** Shows only matches this user joined as a player (not organized).

**TC-USR-033 | Priority: Medium | Pro-upsell banner visibility**
1. As a non-subscribed user, view the Matches tab.
2. As a subscribed user (see Module 10), view the same tab.
- **Expected:** Banner "PRO MEMBER EXCLUSIVE… Upgrade to Pro" shows only for non-subscribers and routes to `/subscription` when tapped; disappears once subscribed.

**TC-USR-034 | Priority: Medium | Matches tab empty state CTA**
1. As a new user with no nearby/own/joined matches, check each segment's empty state.
- **Expected:** Shows **"Create a Match"** CTA → `/create-match`.

**TC-USR-035 | Priority: Medium | Home — Tournaments tab**
1. Switch to the **Tournaments** tab.
- **Expected:** Lists tournaments tracked locally on this device (see Module 6 caveat) as cards → tapping opens `/tournament/[id]`; empty state shows **"Host a Tournament"** → `/create-tournament`.

**TC-USR-036 | Priority: Medium | Home — Trainer tab**
1. Switch to the **Trainer** tab.
- **Expected:** Shows nearby trainer cards → tapping opens `/trainer/[id]`; empty state shows **"Find a Trainer"** → `/explore`.

**TC-USR-037 | Priority: Medium | Home — Walk/Run tab**
1. Switch to the **Walk/Run** tab.
- **Expected:** Shows **"Start Activity"** hero card (→ `/activity-tracker`), quick-pick chips (Walk/Run/Cycle), "Recent Activities" list, and "All →" link (→ `/activity-history`).

**TC-USR-038 | Priority: High | Explore — category radial picker**
1. Open **Explore**, tap the radial pie menu and select each of the 4 segments: **Venues**, **Trainers**, **Games**, **Events**.
- **Expected:** Selected category is visually indicated and drives the filters/results shown next.

**TC-USR-039 | Priority: Medium | Explore — Sport filter chips (Games category)**
1. With category = Games, tap chips **All**, **Futsal**, **Cricket**, **Pickleball**.
- **Expected:** Filter chip selection updates the pending search criteria.

**TC-USR-040 | Priority: Medium | Explore — "When?" quick chips and specific date**
1. Tap **Today**, then **Tomorrow**, then **This Weekend**.
2. Tap **"Pick a specific date"** → choose a date in the calendar modal.
- **Expected:** Each option updates the selected date filter correctly; specific-date modal closes and reflects the chosen date on the trigger.

**TC-USR-041 | Priority: Medium | Explore — Search Radius presets and fine-tune**
1. Tap radius presets **5, 10, 20, 50 km** in turn.
2. Use the +/- stepper to fine-tune, watching the live radius map preview update.
- **Expected:** Radius value and map circle update consistently with each interaction.

**TC-USR-042 | Priority: Medium | Explore — "Free only" toggle**
1. Toggle **"Free only"** ON, run a Games search.
- **Expected:** Only free (price = 0 / null) matches appear in results.

**TC-USR-043 | Priority: High | Explore — "Show Results" and infinite scroll**
1. Set some filters → tap **"Show Results"**.
2. Scroll to the bottom of the results repeatedly.
- **Expected:** Results load 10 per page; scrolling near the bottom triggers loading more (infinite scroll) without duplicate or missing items.

**TC-USR-044 | Priority: Medium | Explore results — Venue card "Book Now"**
1. In Venues category results, tap **"Book Now"** on a venue card.
- **Expected:** Navigates to `/create-match` with that venue pre-selected (verify pre-selection actually carries through).

**TC-USR-045 | Priority: Medium | Explore results — Game card "Join Game"**
1. In Games category results, tap **"Join Game"**.
- **Expected:** Navigates to `/join-match/[id]` for the correct match.

**TC-USR-046 | Priority: Medium | Explore results — Trainer card "View Trainer"**
1. In Trainers category results, tap **"View Trainer"**.
- **Expected:** Navigates to `/trainer/[id]` for the correct trainer.

**TC-USR-047 | Priority: Medium | Explore results — Event card "View Tournament"**
1. In Events category results, tap **"View Tournament"**.
- **Expected:** Navigates to `/tournament/[id]` for the correct tournament.

**TC-USR-048 | Priority: Medium | Explore — Map toggle and pin interaction**
1. From results, tap **Map** toggle.
2. Tap a pin.
- **Expected:** Switches to map view with pins for all results; tapping a pin opens a bottom sheet with that item's summary; **Create Game** and refresh/new-search FABs are present and functional.

**TC-USR-049 | Priority: Low | Explore — category-switch chips on the results screen**
1. From Venues results, switch directly to Trainers via the in-results category chips (without going back to the radial picker).
- **Expected:** Results reload for the new category using the same location/radius filters where applicable.

---

## 6. Module 3 — Match Flow (Create, Join, Checkout, Scoring)

**TC-USR-050 | Priority: High | Create Match — full happy path at Colombo Sports Hub**
1. As Ashan Perera, tap the FAB → **"Create Match"**.
2. Radial **Select Activity** → choose **Futsal**.
3. **Event Title** — accept the auto-suggested title or edit it, e.g. `Ashan's Saturday Futsal`.
4. Tap **Venue / Arena** → in "Select Venue" modal, search `Colombo Sports Hub` → select **"Colombo Sports Hub – Colombo 05"**.
5. Pick a date → under **Available Time Slots**, select one open slot (e.g. `18:00–19:00`).
6. **Total Slot Price (LKR)** auto-fills based on the venue's price (LKR 3000) — verify it matches.
7. Set **Max Players** = `10`, **Min Players** = `6`.
8. Review the **Price Breakdown & Guarantee** card — per-player price should equal 3000 ÷ 10 = LKR 300; "Your max guarantee" should equal the organizer's exposure if only 6 join.
9. Tap **Invite Players** → search and **Add** Dilshan Silva directly (immediate add).
10. Notes = `Bring your own bibs, floodlit court.`
11. Tap **"View Rules & Guidelines"**, read, close.
12. Check **"I accept Paasxo's Terms of Service and Community Guidelines"**.
13. Tap **"Continue to Checkout"** (should now be enabled).
- **Expected:** Booking is created; Dilshan is added as a confirmed player immediately (direct add); app routes to `/checkout/[id]`.

**TC-USR-051 | Priority: High | Create Match — multi-slot selection**
1. Repeat the Create Match flow, this time selecting 2 consecutive slots (e.g. `19:00–20:00` and `20:00–21:00`) at "Kandy Kickers – Central Court".
- **Expected:** Total Slot Price = 2 × 2800 = LKR 5600; per-player price recalculates against the combined total; booking on checkout reflects both slots correctly.

**TC-USR-052 | Priority: Medium | Create Match — "Continue to Checkout" disabled until rules accepted**
1. Fill the entire form but leave the Terms checkbox unchecked → attempt to tap **"Continue to Checkout"**.
- **Expected:** Button remains disabled/non-functional until the checkbox is checked.

**TC-USR-053 | Priority: Medium | Create Match — venue search in the Select Venue modal**
1. Open the venue picker, type `Galle` in the search field.
- **Expected:** Only Ruwani Silva's two Galle venues appear in results.

**TC-USR-054 | Priority: Medium | Create Match — unavailable slots are disabled**
1. Pick a date/venue where some slots are already BOOKED or BLOCKED (from vendor-side testing).
- **Expected:** Those slot chips render visibly disabled and cannot be selected.

**TC-USR-055 | Priority: Medium | Create Match — Max Players < Min Players validation**
1. Set Max Players = `4`, Min Players = `6` (min greater than max).
- **Expected:** Blocking validation error or auto-correction preventing an invalid configuration.

**TC-USR-056 | Priority: Medium | Create Match — invite via "Request" vs "Add" in Player Search Sheet**
1. Open **Invite Players**, search for Nadeesha Fernando, and use the **Request** action (sends an invite requiring her acceptance) instead of **Add**.
- **Expected:** Nadeesha's entry shows a pending "✉" marker in the sheet; she does NOT become a confirmed player yet; she should later receive an `INVITATION_RECEIVED` notification (see Module 12).

**TC-USR-057 | Priority: Low | "View Rules & Guidelines" modal content and dismissal**
1. Open and close the rules modal without checking the acceptance box.
- **Expected:** Modal opens/closes correctly; does not itself check the acceptance box.

**TC-USR-058 | Priority: High | Checkout — real PayHere flow, dummy/sandbox mode**
1. Continuing from TC-USR-050, on **Checkout**, review **Booking Summary** (slot fee, service fee, per-player price, total).
2. Select Payment Method (**Saved Card**, **Apple Pay**, or **New Credit/Debit Card**).
3. Tap **"Pay & Confirm {amount}"**.
- **Expected:** Depending on backend `payment.dummy-mode`: if dummy mode, payment resolves instantly without a WebView; otherwise `PayHereCheckoutWebView` opens for a real/sandbox PayHere charge. After completion, the app polls `GET /payments/status/BOOKING/{id}` up to 10× (1.5s apart) before routing to **Booking Status**.

**TC-USR-059 | Priority: High | Booking Status — pending vendor approval state**
1. Immediately after TC-USR-058 (before any vendor action), view **Booking Status**.
- **Expected:** Orange theme, **"Request Sent!"** headline, "PENDING VENUE APPROVAL" badge, explanatory text that the match becomes Active once the venue approves; **"Track My Request"** CTA.

**TC-USR-060 | Priority: High | Booking Status — confirmed state after vendor accepts**
1. As the relevant Vendor, accept the booking (see `QA_Test_Scenarios_Vendor.md`, TC-VEN-087).
2. Reopen Booking Status (or navigate back to it) as Ashan.
- **Expected:** Green theme, **"Booking Confirmed!"** headline, "BOOKING ID" badge, **"View Match Details"** CTA.

**TC-USR-061 | Priority: Medium | Checkout — payment failure handling**
1. Simulate/force a payment failure (e.g. sandbox failure card, or a forced network drop during the WebView step).
- **Expected:** Clear **"Payment Failed"** alert; booking is not left in a false-confirmed state; user can retry.

**TC-USR-062 | Priority: Medium | Checkout — polling timeout ("Still Processing")**
1. If reproducible in a test environment (e.g. delayed webhook), observe behavior when the 10× poll window elapses without confirmation.
- **Expected:** Shows a "Still Processing" style alert rather than silently failing or falsely succeeding.

**TC-USR-063 | Priority: High | Match Details — Owner view controls**
1. As Ashan (organizer), open Match Details for the confirmed booking from TC-USR-060.
- **Expected:** Shows hero, live scoreboard placeholder (if scoring not yet started), organizer info, participants row, **Cancellation & Guarantee Policy** card, **"Invite Players"** button, **Scoring** button, and **"Cancel Booking"** (destructive).

**TC-USR-064 | Priority: High | Match Details — Scoring button label states**
1. Check the Scoring button's label in 3 states: (a) booking still PENDING_VENDOR, (b) booking ACTIVE_MATCH but organizer not subscribed, (c) organizer subscribed and match not yet started.
- **Expected:** Labels read exactly "Score Match · Pending Approval" (a), "Score Match · Pro" (b), "Start Scoring" (c) respectively.

**TC-USR-065 | Priority: High | Match Details — tapping locked Scoring shows the right alert**
1. In state (a) from TC-USR-064, tap the Scoring button.
- **Expected:** Alert "Awaiting Venue Approval" (no further action).
2. In state (b), tap the Scoring button.
- **Expected:** Alert "Pro Feature… Upgrade to Pro" with an **"Upgrade to Pro"** action routing to `/subscription`.

**TC-USR-066 | Priority: High | Match Details — Cancel Booking (organizer)**
1. As Ashan, on a still-PENDING_VENDOR or ACTIVE_MATCH booking, tap **"Cancel Booking"** → confirm the Alert.
- **Expected:** Booking moves to CANCELLED; slot(s) release; if paid, a refund is initiated; joined players (if any) are notified (`MATCH_CANCELLED_NOTIFY`).

**TC-USR-067 | Priority: Medium | Match Details — Viewer view (non-owner)**
1. As Dilshan Silva (not the organizer), open the same Match Details.
- **Expected:** Shows hero, scoreboard, organizer info, participants, **"Invite Players"** (if not full/cancelled), price, and **"Continue to Checkout"** instead of owner-only controls (no Cancel/Scoring-management buttons).

**TC-USR-068 | Priority: High | Join Match — full flow**
1. As Nadeesha Fernando, from Home "Nearby" (or Explore), find Ashan's match → tap **"Join Game"** → **Join Match** screen.
2. Review participants avatar row, map/directions.
3. Tap the bottom **"Join Game"** button.
- **Expected:** Routes to `/join-checkout/[id]`.

**TC-USR-069 | Priority: Medium | Join Match — "Match Full" state**
1. Fill a match to its Max Players (coordinate multiple test users), then have one more user attempt to view/join it.
- **Expected:** Bottom button reads **"Match Full"** and is disabled; join is blocked.

**TC-USR-070 | Priority: Medium | Join Match — "Already Joined" state**
1. As a user who already joined, reopen the same Join Match screen.
- **Expected:** Bottom button reads **"Already Joined"**, disabled.

**TC-USR-071 | Priority: High | Join Checkout — pay and join**
1. Continuing from TC-USR-068, on **Join Checkout**, verify the chip reads "You" (single player), per-player price matches the match's configured price.
2. Review **Payment Breakdown** (player fee, Service Fee %, Total Due).
3. Select a Payment Method → tap **"Pay & Join {amount}"**.
- **Expected: [Known behavior]** — this is a **simulated** payment (800ms delay, no real gateway); on success calls `bookingApi.joinMatch` (direct join path) and routes back to `/join-match/[id]` showing "Already Joined".

**TC-USR-072 | Priority: Medium | Join Checkout — free match uses "Join Match" label**
1. Join a match where price is 0/null.
- **Expected:** CTA reads **"Join Match"** (no amount) instead of "Pay & Join {amount}".

**TC-USR-073 | Priority: Medium | Join Checkout via accepted invitation (different payment path)**
1. As Nadeesha (who received and accepted an invite requiring payment — see Module 12), reach Join Checkout via the invitation-accept route.
2. Complete payment.
- **Expected:** Calls `invitationApi.completePayment(invitationId, 'SIMULATED_PAYMENT_REF')` instead of the direct `joinMatch` path — confirm the end result (player added, invitation marked JOIN_COMPLETED) is equivalent either way.

**TC-USR-074 | Priority: Medium | Join Checkout — "Invite Players" before joining yourself**
1. From Join Match screen (before tapping Join), tap **"Invite Players"** and request-invite another user.
- **Expected:** Works independently of whether you yourself have joined yet; only organizer/existing participants can direct-add, non-participants can only "Request".

**TC-USR-075 | Priority: High | Match Scoreboard — Organizer-only lock**
1. As Dilshan (a joined player, not organizer), open `/match/[id]/scoring` for Ashan's match.
- **Expected:** Locked screen: "Only the player who created this match can score it" — no scoring controls accessible.

**TC-USR-076 | Priority: High | Match Scoreboard — Pro-subscription lock**
1. As Ashan (organizer, not yet subscribed), open the scoring screen.
- **Expected:** "Pro Feature" lock state with **"Upgrade to Pro"** button → `/subscription`.

**TC-USR-077 | Priority: High | Match Scoreboard — Start Match**
1. As Ashan, now with an active Pro subscription (Module 10) and an ACTIVE_MATCH booking, open scoring → tap **"Start Match"** (▶).
- **Expected:** Match transitions NOT_STARTED → LIVE; live timer begins; control bar now shows **Pause**/**Resume** and **End Match**.

**TC-USR-078 | Priority: Medium | Match Scoreboard — Pause / Resume**
1. Tap **Pause** → verify timer stops and state shows PAUSED.
2. Tap **Resume** → verify timer continues and state returns to LIVE.
- **Expected:** State transitions correctly both ways; other viewers (e.g. Dilshan viewing read-only) see the same paused/live state within one poll cycle (~4s).

**TC-USR-079 | Priority: High | Match Scoreboard — sport-specific controls (Futsal)**
1. On a Futsal match, use `FutsalScoringControls` to increment Team A and Team B scores.
- **Expected:** Score updates immediately on-screen and (within ~4s) for any other viewer with the scoreboard open.

**TC-USR-080 | Priority: Medium | Match Scoreboard — sport-specific controls (Cricket / Pickleball / Paddleball)**
1. Repeat scoring on a Cricket match (`CricketScoringControls`) and a Pickleball/Paddleball match (`RacketScoringControls`) — create one match of each type at the appropriate vendor venue/sport if available.
- **Expected:** Each sport's control set behaves correctly and independently; verify `SCOREABLE_SPORTS` (Futsal, Cricket, Pickleball, Paddleball) is the complete and correct list — any other sport should not expose a scoring screen at all.

**TC-USR-081 | Priority: High | Match Scoreboard — End Match**
1. Tap **"End Match"** → confirm the Alert ("Finish scoring this match? The final score will be shown to everyone.").
- **Expected:** Match status → COMPLETED; scoring controls disappear/lock; Match Details Scoring button now reads "View Final Score"; any further Start/Pause/Resume/End/Reset call is rejected server-side ("already ended").

**TC-USR-082 | Priority: Medium | Match Scoreboard — Reset**
1. Before ending, tap "Reset scoring to initial state" → confirm the destructive Alert.
- **Expected:** Score/timer/events all clear back to NOT_STARTED; confirm a COMPLETED match cannot be reset (per backend rule) — attempting to reset an already-COMPLETED match should fail gracefully.

**TC-USR-083 | Priority: Medium | Match Scoreboard — viewing is open to any authenticated user**
1. As a third, uninvolved user (not organizer, not a joined player), attempt to view (not edit) the live scoreboard for a public ACTIVE_MATCH.
- **Expected:** Viewing (GET) succeeds for anyone authenticated — only mutation actions are restricted.

**TC-USR-084 | Priority: Medium | Match Scoreboard — polling behavior**
1. While a match is LIVE, background the app for over a minute, then foreground it again.
- **Expected:** Scoreboard resumes polling every 4 seconds while active and not COMPLETED; local 1-second timer ticks smoothly between polls without drifting significantly out of sync after resuming.

**TC-USR-085 | Priority: Medium | Direct Add during match setup shows "Added" state**
1. During Create Match (TC-USR-050), after tapping **Add** on Dilshan, reopen the Invite Players sheet.
- **Expected:** Dilshan's entry now shows **"Added"** instead of **"Add"**.

---

## 7. Module 4 — Tournament Flow

**TC-USR-086 | Priority: High | Create Tournament — Step 1: Sport**
1. As Nadeesha Fernando, tap FAB → **"Create Tournament"**.
2. On step **Sport**, select the **Futsal** card → **Continue**.
- **Expected:** Advances to step 2 (Basics); step indicator shows 1 of 7 complete.

**TC-USR-087 | Priority: High | Create Tournament — Step 2: Basics**
1. Add a Cover Image.
2. **Tournament Name*** = `Colombo Futsal Cup 2026` (required).
3. Description = `Community 5-a-side knockout tournament.`
4. Toggle **Open Registration** ON.
5. Set expected teams count = `4`.
6. Tap **Venue** → select **"Colombo Sports Hub – Colombo 05"**.
7. Pick a date and a time-slot.
8. Tap **"Create & Continue"**.
- **Expected:** Tournament is created server-side (`POST /futsals/{id}/tournaments`) AND tracked locally on-device via `tournamentStorage`. Advances to step 3 (Rules).

**TC-USR-088 | Priority: Medium | Create Tournament — Basics validation (name required)**
1. Leave Tournament Name blank → attempt **"Create & Continue"**.
- **Expected:** Blocking validation error.

**TC-USR-089 | Priority: Medium | Create Tournament — Step 3: Rules**
1. Review pre-filled default rules for Futsal (`DEFAULT_RULES`).
2. Add a custom rule, e.g. `No sliding tackles.`
3. Remove one default rule.
4. Tap **"Next: Add Teams"** (only enabled once rules are accepted).
- **Expected:** Custom rule persists; removed rule no longer shows; advances to step 4.

**TC-USR-090 | Priority: High | Create Tournament — Step 4: Teams (create 4 teams)**
1. Enter team name `Colombo Comets` → **"Add Team"**.
2. Repeat for `Kandy Kestrels`, `Galle Gladiators`, `Nugegoda Ninjas`.
- **Expected:** All 4 teams are created (`tournamentApi.createTeam`) and listed; advances to step 5 when ready.

**TC-USR-091 | Priority: Medium | Create Tournament — Step 4: "Skip — add players later"**
1. With fewer than 2 teams created, tap **"Skip — add players later"**.
- **Expected:** Allowed to proceed to the Players step even without a full roster of teams (only blocked below 2 teams per the stated condition — verify exact threshold).

**TC-USR-092 | Priority: High | Create Tournament — Step 5: Players (add 5+ players per team)**
1. Select team **"Colombo Comets"**.
2. Search users via `socialMediaApi.searchUsers` and **Add** Ashan Perera, Dilshan Silva, Chamara Jayasuriya to this team.
3. Switch to **"Kandy Kestrels"** and add Ishara Rajapaksa and 2–3 more searchable test users.
4. Tap **"Next: Schedule Matches"**.
- **Expected:** Players are added correctly per team; duplicate-add of the same player to the same team is prevented (confirm by attempting to add Ashan twice).

**TC-USR-093 | Priority: Medium | Create Tournament — adding an unusually large squad (no server cap)**
1. Continue adding players to "Colombo Comets" well past a typical futsal squad size (e.g. 15+ players).
- **Expected: [Confirmed gap]** — per backend research, there is no server-side maximum team size enforced; confirm the UI also allows this without a blocking error, and flag to the team if a cap is actually expected by the business.

**TC-USR-094 | Priority: High | Create Tournament — Step 6: Matches (manual)**
1. Pick Team A = `Colombo Comets`, Team B = `Kandy Kestrels`, optionally assign a slot → **"Add Match"**.
- **Expected:** Fixture is created and listed; Team A/B cannot both be the same team (verify: try selecting the same team for both sides — should be blocked or simply not selectable as Team B once chosen as Team A).

**TC-USR-095 | Priority: High | Create Tournament — Step 6: "Generate Round Robin"**
1. With all 4 teams created, tap **"Generate Round Robin"**.
- **Expected:** Auto-creates all C(4,2) = 6 team-pair fixtures with no duplicates and no team playing itself.

**TC-USR-096 | Priority: High | Create Tournament — Step 7: Review & Launch**
1. Review the summary → tap **"Launch Tournament 🚀"**.
- **Expected:** Tournament is finalized and appears immediately in Nadeesha's **"My Tournaments"** list (`/tournaments`) with lifecycle badge **Upcoming**.

**TC-USR-097 | Priority: High | "My Tournaments" is local-device-only — cross-device gap**
1. As Nadeesha, note the tournament appears on the device used to create it.
2. Sign in as Nadeesha on a second device (or reinstall the app / clear local storage) and check `/tournaments`.
- **Expected: [Confirmed gap]** — the tournament will NOT appear as "mine" on a different device/after a reinstall, since `tournamentStorage` is purely local (`AsyncStorage`), not server-driven. Confirm this reproduces and document clearly, since it may surprise real users. Note the tournament IS still reachable/findable via Explore → Events for everyone, just not tagged as "mine" cross-device.

**TC-USR-098 | Priority: Medium | Tournaments List — lifecycle badges**
1. View `/tournaments` with tournaments in different states (not started, currently live, finished).
- **Expected:** Correct badges: Upcoming / **Live Now** (pulsing dot) / Completed.

**TC-USR-099 | Priority: Medium | Tournaments List — empty state**
1. As a fresh user with no tracked tournaments, view `/tournaments`.
- **Expected:** "No tournaments yet" + **"Create a Tournament"** CTA.

**TC-USR-100 | Priority: High | Tournament Details — Teams and roster modal**
1. Open the Colombo Futsal Cup tournament → tap the **"Colombo Comets"** team card.
- **Expected:** Opens a roster modal listing all added players correctly.

**TC-USR-101 | Priority: Medium | Tournament Details — "Add Team" is owner-only**
1. As Nadeesha (creator), confirm **"Add Team"** is visible under "Teams (N)".
2. As Dilshan (not creator), view the same tournament.
- **Expected:** "Add Team" and "Schedule" (add match) controls are hidden/disabled for non-owners; Dilshan can still view teams/fixtures read-only.

**TC-USR-102 | Priority: High | Tournament Details — Fixtures list and status pills**
1. View "Fixtures (N)" — check a not-yet-started match (crossed-swords icon, "Scheduled" pill), and (after scoring begins) a "Live" and "Final" pill.
- **Expected:** Pills and icon states accurately reflect each match's actual status.

**TC-USR-103 | Priority: High | Tournament Match Scoring — owner-gated, Pro-gated**
1. As Nadeesha (tournament creator, i.e. "owner" for this purpose), open a fixture → tap into `/tournament/[id]/match/[matchId]`.
2. As Dilshan (not creator), attempt the same.
- **Expected:** Nadeesha, once subscribed (via `SubscriptionGate`), can access scoring; Dilshan is blocked regardless of subscription status, since ownership here is `tournament.createdBy`, not per-match.

**TC-USR-104 | Priority: High | Tournament Match Scoring — Futsal (goal/assist/card events)**
1. On a Futsal fixture, use the **SCORE** tab to add a goal with minute + scoring player, then an assist, then a card.
2. Switch to the **EVENTS** tab.
- **Expected:** Each event appears correctly timestamped/attributed in the Events log; score total updates to match the logged goals.

**TC-USR-105 | Priority: Medium | Tournament Match Scoring — Cricket (ball-by-ball)**
1. On a Cricket fixture, log balls across an over (runs, wickets, extras) using the ball-by-ball tracker.
2. Check the **STATS** tab.
- **Expected:** Overs/wickets/extras totals compute correctly from the logged balls.

**TC-USR-106 | Priority: Medium | Tournament Match Scoring — Pickleball (games/sets)**
1. On a Pickleball fixture, log points across games/sets.
- **Expected:** Game/set win conditions and running score display correctly.

**TC-USR-107 | Priority: High | Tournament score persistence — local override fallback**
1. Log a score change on any tournament fixture.
2. Force-close and reopen the app, then revisit that fixture.
- **Expected: [Known behavior]** — `tournamentApi.updateScore` is explicitly marked "speculative — not implemented yet" server-side; the app also writes to a local override cache (`tournamentStorage`) as the real source of truth. Confirm the score still displays correctly on this same device (via local cache) even if the server call 404s, and separately confirm (if testable) whether the score is visible from a DIFFERENT device/account — if not, that's the expected consequence of this gap, not a new bug.

**TC-USR-108 | Priority: Low | Tournament — share icon**
1. On Tournament Details, tap the share icon.
- **Expected:** Opens the native share sheet with a sensible shareable link/text.

**TC-USR-109 | Priority: Medium | Create Tournament for a second sport (Cricket) at a different vendor's venue**
1. As Ashan, create a second tournament, Sport = Cricket, Venue = "Kandy Kickers – Central Court".
- **Expected:** Works independently of the first tournament; confirms multi-sport, multi-vendor tournament creation both function correctly.

**TC-USR-110 | Priority: Low | Cancel out of the tournament wizard mid-way**
1. Start the wizard, reach step 4 (Teams), then navigate back out of the flow entirely.
- **Expected:** No partial/orphaned tournament is left behind once the tournament itself was already created server-side at step 2 — verify whether abandoning after Step 2 leaves a "ghost" tournament the user never intended to finish, since the tournament is created as early as the Basics step's "Create & Continue". Document actual behavior.

---

## 8. Module 5 — Trainer Booking Flow (customer side)

> Precondition: Trainers Kasun Fernando, Dilani Wijesekara, Roshan Silva have completed profiles, created sessions, and generated availability (see `QA_Test_Scenarios_Trainer.md`, Modules 3, 4, 6).

**TC-USR-111 | Priority: High | Browse trainers from Home "Trainer" tab**
1. As Chamara Jayasuriya, on Home, switch to the **Trainer** tab.
- **Expected:** Nearby trainer cards appear (Kasun, Dilani, Roshan if within range/no radius filter applied) with name, category, rate.

**TC-USR-112 | Priority: High | Trainer Profile screen — full detail check**
1. Tap into Kasun Fernando's card → **Trainer Profile**.
- **Expected:** Hero cover/avatar/name/location/rating pill; category chips **Gym, CrossFit**; stat cards Experience (8 yrs), Hourly Rate (LKR 2000), Sessions count (2); About/Certifications/Gallery sections; **Sessions** list showing both "Morning Strength Bootcamp" and "Evening CrossFit Blast" with correct day/time/price summaries.

**TC-USR-113 | Priority: High | Trainer Session Details — in-person session**
1. Tap "Morning Strength Bootcamp" → **Trainer Session Details**.
- **Expected:** Category pill "Gym", title, "with Kasun Fernando", fact chips (06:00 AM · 60 min, 10 spots, location "Independence Square, Colombo 07"), About/What-to-Bring text, **"Pick a Date"** horizontal list of upcoming Mon/Wed/Fri dates with spots-left counts, **Location** map + working **"Directions"** link, **Session Guidelines** card.

**TC-USR-114 | Priority: High | Trainer Session Details — online session shows no map**
1. View "Sunrise Yoga Flow" (Dilani, online).
- **Expected:** Shows "This is an online session…" notice instead of a map/directions link.

**TC-USR-115 | Priority: Medium | "Calendar" full-month view**
1. On Trainer Session Details, tap the **"Calendar"** button.
- **Expected:** Opens `AvailabilityCalendarModal` showing the full month with bookable dates highlighted/selectable; disabled ("Full") dates are visually distinct.

**TC-USR-116 | Priority: High | Non-Pro user is blocked with an upsell banner and locked CTA**
1. As Chamara (not yet subscribed), select a date on "Morning Strength Bootcamp" → observe the "Joining trainer sessions is a PAASXO Plus perk — upgrade to book." banner and the **"Unlock & Join"** (lock icon) bottom CTA.
2. Tap it.
- **Expected:** Alert "PAASXO Plus Required… Upgrade" with an **"Upgrade"** action → `/subscription`; no navigation to checkout occurs.

**TC-USR-117 | Priority: High | Subscribed user proceeds to Trainer Checkout**
1. As Chamara, after subscribing (Module 10), repeat: pick a date on "Morning Strength Bootcamp" → tap **"Continue"**.
- **Expected:** Routes to `/trainer-checkout/[slotId]` with session/date params carried through correctly (no booking/payment made yet at this point).

**TC-USR-118 | Priority: High | Trainer Checkout — guidelines checkbox gates payment**
1. On Trainer Checkout, review the session summary and **Payment Breakdown**.
2. Attempt to tap **"Pay & Join {amount}"** WITHOUT checking the guidelines checkbox.
- **Expected:** Button is disabled/blocked until the checkbox — "I've read the session guidelines and confirm I'm fit to participate, or I'll inform the trainer of any health conditions or injuries beforehand." — is checked.

**TC-USR-119 | Priority: High | Trainer Checkout — complete payment and confirmation**
1. Check the guidelines box → select a Payment Method → tap **"Pay & Join {amount}"**.
- **Expected: [Known behavior]** — simulated payment (800ms delay, no real gateway) → calls `trainerApi.joinSlot(slotId)` → routes to **Trainer Booking Confirmed**.

**TC-USR-120 | Priority: Medium | Trainer Booking Confirmed screen**
1. Review the confirmation: "You're In!", date/time/location/price paid summary, "Booking #{id}".
2. Tap **"Add to Calendar"**.
3. Tap **"Done"**.
- **Expected:** "Add to Calendar" opens a working Google Calendar deep link with correct event details; "Done" routes to `/explore?category=TRAINERS`.

**TC-USR-121 | Priority: High | Session date reaches capacity — "Full" state**
1. Have enough subscribed users (reuse the 5 test users, or lower a test session's capacity to 2 for a fast repro) join the same date until `bookedCount == capacity`.
2. As one more subscribed user, revisit that date in "Pick a Date".
- **Expected:** That date shows disabled/"Full"; attempting to select it is blocked client-side, and would also be rejected server-side ("This session date is full").

**TC-USR-122 | Priority: Medium | Duplicate join on the same date is prevented**
1. As Chamara (already joined a date), attempt to join the exact same date again.
- **Expected:** Blocked with "You've already joined this session date" (or equivalent) — no duplicate booking/charge.

**TC-USR-123 | Priority: High | "My Trainer Bookings" — confirmed gap, no UI screen**
1. As Chamara (after joining a session), search the entire app (Profile, Settings, Notifications, Home) for any list of her own trainer bookings or a way to cancel one.
- **Expected: [Confirmed gap]** — no such screen exists in this build even though the backend supports `GET /trainers/bookings/my` and `PATCH /trainers/bookings/{id}/cancel`. Document this clearly as a product gap rather than searching indefinitely for a hidden entry point.

**TC-USR-124 | Priority: Medium | Book sessions across all 3 trainers to confirm independence**
1. As different users, book one session each from Kasun, Dilani, and Roshan.
- **Expected:** Each booking is independent, correctly attributed, and shows correctly on the respective Trainer's Session Roster (cross-check against `QA_Test_Scenarios_Trainer.md`).

**TC-USR-125 | Priority: Low | Trainer category filter round-trip from Explore**
1. From Explore, category = Trainers, and (if a sub-filter for trainer category exists) filter specifically for "Martial Arts".
- **Expected:** Only Roshan Silva (and any other Martial Arts trainer) appears.

---

## 9. Module 6 — Social Features: Feed, Posts, Reels, Stories

**TC-USR-126 | Priority: High | Feed — real post feed loads with infinite scroll**
1. As Ashan, open **Feed**.
2. Scroll down repeatedly.
- **Expected:** Real `PostCard` items load via `FlatList` with `onEndReached` pagination; pull-to-refresh at the top reloads the feed from page 1.

**TC-USR-127 | Priority: Low | Feed — static demo sections are clearly non-interactive/non-live**
1. Note the "Live & Recent" scores (ST vs BL, TI vs DC), "SPONSORED" card, "FEATURED EVENT" card, and "Discover Communities" grid.
- **Expected: [Known behavior]** — these are hardcoded demo content, not live data; confirm they don't claim to be real (e.g. don't silently break other real functionality) and that the "Learn More"/dismiss-X/"View Rankings" controls on them don't crash even though they're not fully functional.

**TC-USR-128 | Priority: High | Post Card — Like toggle**
1. Tap the heart icon on a post.
- **Expected:** Like count increments and heart fills; tapping again un-likes (count decrements, heart empties). Post author receives a `POST_LIKED` notification on first like.

**TC-USR-129 | Priority: High | Post Card — Comment**
1. Tap the comment icon → `CommentSheet` opens.
2. Type and submit a comment.
- **Expected:** Comment appears in the sheet immediately; post's comment count increments; post author receives `POST_COMMENTED` notification.

**TC-USR-130 | Priority: Medium | Post Card — Save/Bookmark**
1. Tap the bookmark icon.
- **Expected:** Post is added to Profile → **Saved** tab; tapping again removes it.

**TC-USR-131 | Priority: Low | Post Card — Share**
1. Tap the Share2 icon.
- **Expected:** Opens the native share sheet.

**TC-USR-132 | Priority: High | Create Post — full flow with tag & location**
1. As Ashan, tap FAB → **"Create Post"**.
2. Pick an image from gallery (or capture via camera).
3. Write a caption: `Great match today at Colombo Sports Hub! 🏆`.
4. Toggle visibility to **public**.
5. Tap **"Tag people"** → search and tag Dilshan Silva.
6. Tap **"Add location"** → search/select a location on the map, confirm.
7. Tap **"Post"** (top-right).
- **Expected:** Button label switches to "Posting..." during upload; on success, post appears at the top of Ashan's Feed and Profile → Moments tab with correct caption, tagged user, and location.

**TC-USR-133 | Priority: Medium | Create Post — private visibility**
1. Create a second post with visibility = **private**.
- **Expected:** Only followers (if account is private) or a restricted audience per the app's privacy model can see it — cross-check with a non-follower account.

**TC-USR-134 | Priority: Medium | Create Post — camera capture path**
1. Repeat Create Post using the camera capture option instead of gallery.
- **Expected:** Camera opens, captured photo is used identically to a gallery pick.

**TC-USR-135 | Priority: Low | Create Post — empty caption is allowed**
1. Post an image with no caption text.
- **Expected:** Post publishes successfully with a blank caption (verify this is actually allowed, or document if blocked).

**TC-USR-136 | Priority: High | Create Reel — required caption, video-only, max 180s**
1. Tap FAB (Feed tab) → **"Create Reel"**.
2. Record/select a short video clip.
3. Try to submit with an EMPTY caption.
- **Expected:** Blocked — caption is required for Reels.
4. Add a caption, optionally apply a filter and add music via the music picker, tap **"Post Reel"**.
- **Expected:** Reel uploads and appears on Profile → Reels tab.

**TC-USR-137 | Priority: Medium | Create Reel — max duration enforcement**
1. Attempt to use/select a video longer than 180 seconds.
- **Expected:** Blocked or auto-trimmed to the 180s max — confirm actual behavior.

**TC-USR-138 | Priority: Medium | Create Story — photo or video, optional caption, Boomerang**
1. Tap FAB (Feed tab) → **"Create Story"**.
2. Capture a photo, apply a filter, add a text sticker.
3. Toggle **Boomerang** — capture a boomerang clip instead.
4. Tap **"Share Story"** (no caption required).
- **Expected:** Story uploads successfully without requiring a caption; appears in the `StoryReel` at the top of Feed for the author's followers.

**TC-USR-139 | Priority: Medium | Create Story — max 30s video enforcement**
1. Attempt a video story longer than 30 seconds.
- **Expected:** Blocked or auto-trimmed.

**TC-USR-140 | Priority: Low | Capture flow — filter carousel**
1. In Create Reel/Story, swipe through `CAPTURE_FILTERS`.
- **Expected:** Each filter visibly changes the live camera preview without lag/crash.

**TC-USR-141 | Priority: Low | Capture flow — music picker**
1. Tap the Music picker → select an audio track (via `audioApi`).
- **Expected:** Track is attached to the reel/story; playback during preview includes the selected audio.

**TC-USR-142 | Priority: Medium | Story viewing marks it as viewed**
1. As Dilshan, tap into Ashan's story from the `StoryReel`.
- **Expected:** Story plays; a view is recorded (`STORIES.VIEW`); if Ashan checks story viewers (if that UI exists), Dilshan should be listed.

---

## 10. Module 7 — Friends, Follow, Chat, Profile

**TC-USR-143 | Priority: High | Set Ishara's account to Private**
1. As Ishara Rajapaksa, go to **Settings** → toggle **"Private Account"** ON.
- **Expected:** Toggle saves via `userApi.updatePrivacy(true)`; subtitle confirms "Approve who can follow you and see your posts".

**TC-USR-144 | Priority: High | Follow a public account — immediate follow**
1. As Dilshan, go to **Friends** → search for `Ashan Perera` (public) → tap **Follow**.
- **Expected:** Button immediately changes to **Following** (no approval needed since Ashan's account is public); Ashan receives a `NEW_FOLLOWER` notification.

**TC-USR-145 | Priority: High | Follow a private account — request flow**
1. As Dilshan, search for `Ishara Rajapaksa` (private, from TC-USR-143) → tap **Follow**.
- **Expected:** Button shows a pending "Requested" state (not immediately Following); Ishara receives a `FOLLOW_REQUEST_RECEIVED` notification.

**TC-USR-146 | Priority: High | Requests tab — Accept a follow request**
1. As Ishara, open **Friends** → **Requests** tab (badge shows 1).
2. Tap **Accept** on Dilshan's request.
- **Expected:** Request disappears from the list; Dilshan is now actually following Ishara (his earlier "Requested" state flips to "Following"); Dilshan receives `FOLLOW_REQUEST_ACCEPTED`.

**TC-USR-147 | Priority: Medium | Requests tab — Decline a follow request**
1. Have Chamara send Ishara a follow request.
2. As Ishara, tap **Decline** on Chamara's request.
- **Expected:** Request removed; Chamara remains not-following Ishara; her Follow button reverts to available (not stuck on "Requested").

**TC-USR-148 | Priority: Medium | Unfollow a user**
1. As Dilshan (now following Ashan), tap **Following** on Ashan's row/profile.
- **Expected:** Confirms/toggles back to **Follow**; Ashan's follower count decreases.

**TC-USR-149 | Priority: Medium | Friends — Followers / Following tab counts and lists**
1. Check Ashan's **Followers** tab (should include Dilshan after TC-USR-144) and **Following** tab.
- **Expected:** Lists and counts are accurate and update in near real-time after follow/unfollow actions.

**TC-USR-150 | Priority: Medium | Friends — Suggested tab and location-based sorting**
1. As a new user, open the **Suggested** tab (grant location permission if prompted).
- **Expected:** Silently calls `userApi.updateLocation(lat, lng)` (per code, this is the app's only location-update mechanism) and returns suggestions, ideally sorted with nearer users favored.

**TC-USR-151 | Priority: Low | Friends — search with no matches**
1. Search for a nonsense string like `zzzzznotarealuser`.
- **Expected:** Shows an empty-results state, no crash.

**TC-USR-152 | Priority: Medium | Friend Profile — restricted view for a private non-followed account**
1. As Chamara (not following Ishara), open **Friend Profile** for Ishara.
- **Expected:** Moments tab shows a locked state: "Follow Ishara to see their moments." Stats/Reels/Tagged tabs behavior should be checked too — confirm which tabs are similarly restricted vs still visible.

**TC-USR-153 | Priority: Medium | Friend Profile — full access after being accepted**
1. As Dilshan (now an accepted follower of Ishara, from TC-USR-146), reopen Ishara's Friend Profile.
- **Expected:** Moments tab is now fully visible (no lock state).

**TC-USR-154 | Priority: Medium | Friend Profile — Message button**
1. On any Friend Profile, tap **"Message"**.
- **Expected:** Routes to `/chat/[userId]`.

**TC-USR-155 | Priority: High | Chat screen is fully mocked — confirm no real messaging occurs**
1. Open chat with two DIFFERENT users (e.g. `/chat/[dilshanId]` and separately `/chat/[nadeeshaId]`).
2. Compare the header/profile shown in both.
- **Expected: [Confirmed gap]** — header shows a hardcoded demo profile ("Marcus Chen") regardless of which user you opened chat with; message list is a hardcoded demo array. Send a message in one chat, then reopen the app or navigate away and back.
- **Expected:** The sent message is only appended to local component state — no backend call — so it will NOT persist a reload, and it will NOT be visible from the other user's account at all. Confirm and document this clearly as "prototype only, not functional messaging" rather than filing individual message-delivery bugs.

**TC-USR-156 | Priority: Low | Chat screen decorative controls don't crash**
1. Tap the call/video icons, image/emoji/mic icon buttons in the input bar.
- **Expected:** These are decorative (non-functional) per the code; confirm tapping them doesn't crash the app even though nothing happens.

**TC-USR-157 | Priority: High | Profile — own profile tabs**
1. As Ashan, open **Profile** (own).
2. Check **Moments**, **Saved**, **Stats**, **Reels**, **Tagged** tabs.
- **Expected:** Moments shows Ashan's own posts; Saved shows posts he bookmarked (lazy-loaded on first open); Reels shows his own reels (lazy-loaded); Tagged shows posts he was tagged in (e.g. from TC-USR-132).

**TC-USR-158 | Priority: Medium | Profile → Settings navigation**
1. Tap the top-right icon on Profile.
- **Expected:** Navigates to `/settings`.

**TC-USR-159 | Priority: High | Edit Profile — full field update**
1. From Profile/Settings, reach **Edit Profile**.
2. Tap avatar → **AvatarActionSheet** → choose to change photo.
3. Update "Your name", "Phone number", "Bio" ("Futsal enthusiast, weekend warrior 🏆").
4. Update sport multi-select and **Skill Level**.
5. Toggle **Location Access**.
6. Tap **"Save"**.
- **Expected:** All changes persist (multipart upload including the new avatar only if it was actually changed) and reflect immediately on Profile.

**TC-USR-160 | Priority: Low | Edit Profile — avatar action sheet options**
1. Tap the avatar → check all 3 options: view / change / remove.
- **Expected:** "View" opens a full-screen image viewer; "Change" opens the picker; "Remove" clears the avatar back to a default placeholder.

**TC-USR-161 | Priority: High | Settings — Private Account toggle round-trip**
1. As Ashan (currently public), toggle **Private Account** ON, then back OFF.
- **Expected:** Both toggles persist correctly via `userApi.updatePrivacy`; toggling back to public should make his content visible to non-followers again (verify with a fresh, non-following test account).

**TC-USR-162 | Priority: Medium | Settings — "Change password" is a non-functional stub**
1. Tap **"Change password"**.
- **Expected: [Confirmed bug]** — `onPress` is a no-op; nothing happens. Confirm and log as a functional gap since it's presented as a real, tappable row.

**TC-USR-163 | Priority: Medium | Settings — "Contact HelpDesk" is a non-functional stub**
1. Tap **"Contact HelpDesk"**.
- **Expected: [Confirmed bug]** — `onPress` is a no-op; nothing happens.

**TC-USR-164 | Priority: High | Settings — Logout does NOT actually clear the session**
1. Tap **"Logout"** → observe the Alert ("Logout — You have been logged out.") → app routes to `/sign-in`.
2. Force-close the app entirely and reopen it.
- **Expected: [Confirmed bug — high priority]** — the code explicitly never calls `AuthContext.signOut()`; it's described in-code as a "Placeholder logout flow." Verify whether the app on relaunch silently restores the previous session (auto-navigates past Sign In back into Home) despite the user believing they logged out. If reproduced, this is a real security/UX defect worth escalating — a shared/public device user could believe they've logged out while their session remains active.

---

## 11. Module 8 — Notifications

**TC-USR-165 | Priority: High | Notification bell badge accuracy on Home**
1. Trigger 3 different unread notifications for Ashan (e.g. a like, a comment, a booking confirmation).
2. Check the bell badge on Home.
- **Expected:** Badge count matches exactly (note: Home's bell tracks GENERAL category count specifically per code — confirm SOCIAL-category items like likes/comments are or aren't included in this particular badge, and document actual behavior).

**TC-USR-166 | Priority: Medium | Notifications screen — category filter**
1. Open Notifications with `?category=GENERAL` vs without a filter (or with `?category=SOCIAL` if reachable).
- **Expected:** Filtering correctly separates booking/tournament/trainer/venue/reminder notifications (GENERAL) from follow/like/comment notifications (SOCIAL).

**TC-USR-167 | Priority: Medium | Mark all read**
1. With multiple unread notifications, tap **"Mark all read"**.
- **Expected:** All unread indicators clear; badge count resets to 0.

**TC-USR-168 | Priority: High | Invitation notification — inline Accept**
1. Have Ashan invite Nadeesha to a paid match (Module 3, "Request" flow) so Nadeesha receives an `INVITATION_RECEIVED` notification with status `REQUEST_SENT`.
2. As Nadeesha, open Notifications, find the invite, tap the inline **Accept** button.
- **Expected:** If the invite requires payment (`requiresPayment: true`), routes to `/join-checkout/[bookingId]?invitationId=...`; if free, shows a "Joined!" alert directly without a payment step.

**TC-USR-169 | Priority: Medium | Invitation notification — inline Decline**
1. As a different recipient of an invite, tap **Decline** → confirm the Alert.
- **Expected:** Calls `invitationApi.decline`; invitation status moves to DECLINED; the organizer is notified (`INVITATION_DECLINED`).

**TC-USR-170 | Priority: Medium | Notification — PLAYER_JOINED / PLAYER_ADDED_DIRECTLY (organizer's view)**
1. As Ashan (organizer), after Dilshan is direct-added (Module 3) and after Nadeesha's invite is accepted, check Notifications.
- **Expected:** Two distinct notification types appear correctly reflecting each join mechanism.

**TC-USR-171 | Priority: Medium | Notification — BOOKING_CONFIRMED / BOOKING_REJECTED (organizer)**
1. Cross-reference with the Vendor document's accept/reject tests (TC-VEN-087, TC-VEN-088).
- **Expected:** Ashan receives BOOKING_CONFIRMED when accepted, and a separate organizer receives BOOKING_REJECTED (with reason) when rejected.

**TC-USR-172 | Priority: Low | Notification — FOLLOW_REQUEST_RECEIVED / ACCEPTED / NEW_FOLLOWER**
1. Cross-reference with Module 7's follow tests (TC-USR-144 to TC-USR-147).
- **Expected:** All three types fire at the correct trigger points with correct recipient/actor.

**TC-USR-173 | Priority: Low | Notification — POST_LIKED / POST_COMMENTED / REEL_LIKED**
1. Cross-reference with Module 6 (TC-USR-128, TC-USR-129) and reel-liking (like a reel from Profile → Reels tab, if a like control exists there).
- **Expected:** Correct notification type fires to the content's author, not to the actor.

**TC-USR-174 | Priority: Medium | Notification — TOURNAMENT_PLAYER_ADDED**
1. Add a player to a tournament team (Module 4, TC-USR-092) and check that player's Notifications.
- **Expected:** They receive a TOURNAMENT_PLAYER_ADDED notification.

**TC-USR-175 | Priority: Low | Notification — TRAINER_NEW_SESSION**
1. As Trainer 1 (Kasun), create a brand-new session after already having followers/Pro-subscriber audience (if such targeting exists — per backend research this notification targets "Pro-subscriber followers only").
2. As a subscribed follower of Kasun (if a trainer-follow concept exists — otherwise as any subscribed user, per whatever the actual targeting rule is), check Notifications.
- **Expected:** Verify who actually receives this notification type and document the real targeting behavior observed, since the precise audience logic is worth confirming empirically.

**TC-USR-176 | Priority: Low | Notification — SESSION_REMINDER / MATCH_REMINDER / TOURNAMENT_REMINDER**
1. If testable within a reasonable window (or by inspecting a lowered test-environment reminder lead time), verify a reminder notification fires ahead of a booked trainer session / match / tournament fixture.
- **Expected:** Reminder arrives with correct timing and correct event details.

**TC-USR-177 | Priority: Medium | Notification — VENUE_CLOSED**
1. Cross-reference with `QA_Test_Scenarios_Vendor.md` TC-VEN-067/TC-VEN-145 — have a vendor close a date that has an existing live booking on it.
- **Expected:** The affected organizer receives a VENUE_CLOSED notification.

**TC-USR-178 | Priority: Low | Notification — empty state**
1. View Notifications for a brand-new user account with zero activity.
- **Expected:** Empty state displays cleanly.

---

## 12. Module 9 — Invitations (deep dive)

**TC-USR-179 | Priority: High | Invite → Accept → Free match joins immediately**
1. As Ashan, create a FREE match (price = 0), invite Dilshan via **Invite Players → Request**.
2. As Dilshan, accept the invitation from Notifications.
- **Expected:** Since `booking.totalPrice` is null/0, Dilshan is added to `playerIds` immediately (`JOIN_COMPLETED`) with no payment step — confirms the free-vs-paid accept branching.

**TC-USR-180 | Priority: High | Invite → Accept → Paid match requires a separate payment step**
1. As Ashan, create a PAID match, invite Nadeesha.
2. As Nadeesha, accept the invitation.
- **Expected:** Status moves to `ACCEPTED_AWAITING_PAYMENT`, with `amountDue = totalPrice / maxSpots` returned; Nadeesha is NOT yet in `playerIds` until she completes `/join-checkout` (invitation payment path from TC-USR-073).

**TC-USR-181 | Priority: Medium | Only one active invitation per (booking, recipient) at a time**
1. As Ashan, invite Chamara to a match.
2. Before Chamara responds, attempt to invite Chamara to the SAME match again.
- **Expected:** Blocked with an "already has an active invitation" style error.

**TC-USR-182 | Priority: Medium | Cannot invite yourself**
1. As Ashan (organizer), attempt to search and invite yourself in the Invite Players sheet.
- **Expected:** Either you don't appear in your own search results, or the action is blocked server-side.

**TC-USR-183 | Priority: Medium | Cannot invite/request on a cancelled match**
1. Cancel a match (TC-USR-066), then attempt to invite someone to it.
- **Expected:** Blocked — invitations cannot be created against a CANCELLED booking.

**TC-USR-184 | Priority: Medium | Cannot invite/request on a still-unapproved (PENDING_VENDOR) match**
1. On a match still awaiting vendor approval, attempt to invite another player.
- **Expected:** Blocked until the vendor approves (backend explicitly rejects invites/requests on PENDING_VENDOR matches).

**TC-USR-185 | Priority: Medium | Direct Add is organizer/participant-only**
1. As Dilshan (a joined player, NOT the organizer), open Invite Players from within the match and check whether a "Direct Add" style immediate-add action is available to him the way it is for Ashan.
- **Expected:** Per code, only the organizer gets the "invite-only mode disabled" direct-add capability; confirm Dilshan only sees the "Request" action, not "Add".

**TC-USR-186 | Priority: Medium | Capacity re-check at invite, accept, and payment-completion time**
1. Fill a match to Max Players - 1 (one spot left).
2. Simultaneously (or in quick succession) send 2 separate invites for that last spot to 2 different users, and have both accept around the same time.
- **Expected:** Only one of the two ultimately completes the join; the other's invitation flips to `MATCH_FULL` at whichever checkpoint (invite/accept/payment) the race is caught — confirm the loser gets a clear "match is full" message rather than a stuck/ambiguous state.

**TC-USR-187 | Priority: Medium | Invitation expires at match kickoff time**
1. Send an invite for a match, then let the match's scheduled start time pass without the recipient responding (use a match scheduled in the very near future for a fast repro, or a lowered test value).
2. Attempt to accept it after kickoff.
- **Expected:** Invitation auto-flips to `EXPIRED`; acceptance is rejected with an expiry-related message.

**TC-USR-188 | Priority: Low | "Request to join" from a non-participant on someone else's match**
1. As Chamara (not organizer, not yet joined), from Join Match screen, use "Invite Players" → confirm this only lets her invite OTHERS, and separately confirm her own path to join is the main "Join Game" button, not this sheet.
- **Expected:** UI clearly separates "get others into the match" from "join the match yourself."

---

## 13. Module 10 — Subscription, One-Time Payment & Activity Tracking

**TC-USR-189 | Priority: High | Subscription — Start Free Trial**
1. As Ashan (inactive subscription), open `/subscription` → **plans** mode.
2. Review the benefits list.
3. Tap **"Start Free Trial"** on the "1-Month Free Trial" card.
- **Expected:** Calls `POST /subscriptions/trial`; screen switches to the active state showing "Free Trial" banner with a valid-until date ~1 month out.

**TC-USR-190 | Priority: Medium | Cannot start a second trial while one is already ACTIVE**
1. While Ashan's trial is still active, attempt to start another trial.
- **Expected:** Blocked (trial start is only disallowed while status is currently ACTIVE).

**TC-USR-191 | Priority: Medium | An expired/cancelled subscription CAN start a new trial**
1. Let Ashan's trial lapse (or use an account whose subscription has ended), then attempt **"Start Free Trial"** again.
- **Expected:** Succeeds — per backend research this was an explicit fix (an expired subscription doesn't permanently block re-trialing), so confirm it still works as a regression check.

**TC-USR-192 | Priority: High | Subscription — paid monthly plan (Chamara)**
1. As Chamara, on `/subscription`, tap **"Subscribe Now"** on the "Monthly — LKR 9.99/mo" card → switches to **payment** mode.
2. Fill the card form (Cardholder Name, Card Number, Expiry, CVV).
3. Tap **"Pay LKR 9.99 / month"**.
- **Expected: [Known behavior]** — this is NOT routed through real PayHere; it's a simulated card capture posting a synthetic reference to `POST /subscriptions/activate`. On success, subscription becomes active for 1 month; verify the screen correctly reflects "Pro Member" status afterward.

**TC-USR-193 | Priority: Low | Subscription — "Back to plans" link**
1. From payment mode, tap **"Back to plans"**.
- **Expected:** Returns to plans mode without submitting anything.

**TC-USR-194 | Priority: Medium | Subscription status refreshes on screen focus**
1. Activate a subscription, navigate away to Home, then back to `/subscription`.
- **Expected:** Screen re-fetches status on focus (`useFocusEffect`) rather than showing a stale cached "inactive" state.

**TC-USR-195 | Priority: Medium | Subscription status is cached for 5 minutes elsewhere in the app**
1. Immediately after activating, check a subscription-gated feature (e.g. Match Scoring lock) elsewhere in the app.
- **Expected:** Reflects the new active status promptly; if a stale cache is observed for up to 5 minutes per `useSubscription`'s `SUBSCRIPTION_CACHE_KEY` design, confirm this matches expectations rather than assuming it's a bug — but flag if it takes noticeably longer than 5 minutes.

**TC-USR-196 | Priority: Medium | One-Time Payment — "Single Event Access" flow**
1. As Dilshan (not subscribed), open `/one-time-payment`.
2. Review "Pay LKR 2.99 once to create one match or tournament. No subscription required." and the feature list.
3. Fill the (fake) card form → submit.
- **Expected:** On success, shows "Payment Successful! You can now create one event."; stores a local flag (`paasxo_one_time_credit`) allowing exactly one match/tournament creation.

**TC-USR-197 | Priority: Medium | One-Time credit is consumed after one use**
1. After TC-USR-196, create one match successfully.
2. Attempt to create a second match/tournament without paying again.
- **Expected:** Verify whether the app correctly blocks the second creation (credit consumed) or incorrectly allows unlimited creation — this is a monetization-critical check.

**TC-USR-198 | Priority: Low | One-Time Payment — link to Subscription**
1. Tap "Want unlimited access? View subscription plans →".
- **Expected:** Routes to `/subscription`.

**TC-USR-199 | Priority: High | Activity Tracker — start, pause, resume, finish a Walk**
1. From Home Walk/Run tab, tap **"Start Activity"** → choose **Walk**.
2. Wait for GPS to be ready → tracking begins.
3. Walk/move the test device a short distance (or simulate GPS movement).
4. Tap **Pause**, wait a few seconds, tap **Resume**.
5. Tap the stop control → confirm **"Finish Activity"** Alert.
- **Expected:** Activity saves locally (`activityStorage`, key `@paasxo:activities`) with distanceMeters, durationSeconds, avgSpeedKmh, maxSpeedKmh, estimatedCalories, elevationGainMeters, and a full route polyline; also attempts to sync to server (`POST /activities`).

**TC-USR-200 | Priority: Medium | Activity Tracker — Run and Cycle quick-picks**
1. Repeat TC-USR-199 for **Run** and **Cycle**.
- **Expected:** Each activity type saves and displays with the correct type tag.

**TC-USR-201 | Priority: Medium | Activity History — list, grouping, and filters**
1. Open **Activity History**.
2. Filter by chips **All / Walk / Run / Cycling**.
- **Expected:** Activities are grouped by date and filtered correctly per chip.

**TC-USR-202 | Priority: Medium | Activity Detail — route map and stats**
1. Tap into a saved activity → **Activity Detail**.
- **Expected:** Route renders as a `Polyline` on the map matching the recorded path; stat tiles (including "Route Points" count) are accurate.

**TC-USR-203 | Priority: Medium | Activity Detail — Delete**
1. Tap **"Delete Activity"** → confirm the destructive Alert.
- **Expected:** Activity is removed from local storage and no longer appears in Activity History.

**TC-USR-204 | Priority: Low | Activity Detail — Share**
1. Tap the Share icon.
- **Expected:** Opens native share sheet with activity summary.

**TC-USR-205 | Priority: Medium | Scheduled Walk/Run event — create with a partner invite**
1. From Home, navigate to the **Create Walk/Run** (`/walk-run`) screen (a social scheduling feature, distinct from GPS tracking).
2. Fill Title\* = `Sunday Morning Jog`, Start location\* = `Independence Square`, Date\* = a future date, Time\* = `06:00`.
3. Search and select a partner, e.g. Ishara Rajapaksa.
4. Submit.
- **Expected:** Confirmation text "An invite has been sent to your partner."; as Ishara, check Notifications for a `WALK_RUN_INVITE_RECEIVED` notification.

**TC-USR-206 | Priority: Medium | Scheduled Walk/Run — partner accepts/declines**
1. As Ishara, accept the invite (if an in-app action exists for this notification type — verify and document the actual interaction, since this endpoint (`/walk-runs`) is ad-hoc/not centrally documented in `endpoints.ts`).
- **Expected:** Ashan (or whoever created it) receives `WALK_RUN_INVITE_ACCEPTED` (or `_DECLINED`) accordingly.

**TC-USR-207 | Priority: Medium | Scheduled Walk/Run — required-field validation**
1. Attempt to submit with Title, Start location, Date, or Time left blank (test each individually).
- **Expected:** Each required field blocks submission until filled.

---

## 14. Module 11 — Negative Tests, Access Control & Cross-App Consistency

**TC-USR-208 | Priority: High | A normal User account cannot access Vendor/Trainer-only backend actions**
1. If reachable via any test tooling, attempt to call a vendor-only action (e.g. accept-as-vendor) or trainer-only action (e.g. create session) while authenticated as a plain USER account.
- **Expected:** Rejected by the backend (role check enforced manually per service method — worth spot-checking, since there's no centralized role-based security layer).

**TC-USR-209 | Priority: Medium | Expired/invalid auth token handled gracefully**
1. Force an expired session and perform an action (e.g. like a post).
- **Expected:** Silent token refresh attempted; on failure, user is redirected to Sign In rather than the app crashing or showing raw error output.

**TC-USR-210 | Priority: Medium | Poor/lost network mid-checkout**
1. Enable airplane mode right after tapping "Pay & Confirm" on a real (non-dummy-mode) checkout.
- **Expected:** Clear error/retry messaging; no false "confirmed" state shown while the payment is actually unresolved — verify eventual consistency once connectivity returns (poll/refresh shows the true state).

**TC-USR-211 | Priority: Medium | Double-tap protection on pay/join/submit buttons**
1. Rapidly double/triple-tap **"Pay & Confirm"**, **"Pay & Join"**, **"Create & Continue"**, etc. across a few flows.
- **Expected:** No duplicate bookings/joins/tournaments/posts are created from a single logical submission.

**TC-USR-212 | Priority: Low | Very long text input (captions, titles, bios, notes)**
1. Enter 1000+ character strings into a post caption, a match title/notes field, and a bio.
- **Expected:** Either constrained by max length or gracefully truncated/scrollable in display — no crash or broken layout anywhere.

**TC-USR-213 | Priority: Low | Special characters and emoji across key text fields**
1. Use emoji/special characters in a display name, match title, and post caption.
- **Expected:** Saves and renders correctly everywhere these values are shown (Feed, Profile, Match Details, Notifications, and cross-app in Vendor/Trainer screens where applicable, e.g. organizer name shown to a vendor).

**TC-USR-214 | Priority: Medium | App behavior when the backend is unreachable**
1. Simulate no connectivity while loading Home/Feed.
- **Expected:** Clear loading/error state, no infinite spinner or crash; retry works once connectivity returns.

**TC-USR-215 | Priority: Medium | Backgrounding mid-flow (Create Match, Create Tournament wizard, Capture Flow)**
1. Background the app mid-way through a multi-step flow, then foreground it again.
- **Expected:** In-progress state is reasonably preserved, or the app degrades gracefully back to a sane screen — no crash or silent data loss beyond what's reasonable to expect.

**TC-USR-216 | Priority: High | Price displayed to the user always matches the vendor's/trainer's configured price (server-computed)**
1. Cross-reference with `QA_Test_Scenarios_Vendor.md` TC-VEN-149 and `QA_Test_Scenarios_Trainer.md` TC-TRN-122 — confirm from the User side that displayed totals in Create Match/Checkout and Trainer Checkout always match the source-of-truth vendor/trainer pricing, never a client-manipulated value.
- **Expected:** Consistent across both sides of every cross-app flow.

**TC-USR-217 | Priority: Medium | Notification volume sanity check across a full end-to-end session**
1. Run through Modules 3–9 back to back for one user (Ashan) and count total notifications received.
- **Expected:** No duplicate notifications for the same event, no missing notifications for documented trigger points (cross-check against the type catalogue in Module 8), and no notifications misattributed to the wrong recipient.

**TC-USR-218 | Priority: Low | Deep link / route param tampering (e.g. `/match/[id]` with a nonexistent or another user's id)**
1. Manually navigate to a match/tournament/trainer-session detail route with an ID that doesn't exist, and separately with a valid ID belonging to a different, unrelated resource.
- **Expected:** Graceful "not found" state for invalid IDs; correct-but-restricted view (not a crash or wrong-data leak) for valid IDs the current user shouldn't fully control (e.g. viewing another organizer's match as a non-participant should show the Viewer view, never accidentally the Owner view).

---

## 15. Appendix — Known Behavioral Notes (read before logging bugs)

| Area | Behavior | Status |
|---|---|---|
| Apple Sign-In | Calls the sign-in flow with an empty token; not a real native Apple auth integration | Confirmed bug/gap |
| Settings → Logout | Never calls `AuthContext.signOut()` — session may not actually be cleared despite the "logged out" alert | **Confirmed bug — high priority** |
| Settings → "Change password" | No-op, does nothing when tapped | Confirmed bug |
| Settings → "Contact HelpDesk" | No-op, does nothing when tapped | Confirmed bug |
| Chat (`/chat/[userId]`) | Fully mocked — hardcoded demo profile/messages regardless of which user you open; sending a message never reaches a backend or the other party | Confirmed gap — treat as UI prototype only |
| "My Trainer Bookings" | No screen exists to view/cancel your own trainer bookings, even though the backend API supports it | Confirmed gap |
| Feed static sections (Live & Recent scores, Sponsored, Featured Event, Discover Communities) | Hardcoded demo content mixed into the real feed | By design (currently) |
| "My Tournaments" list | Stored locally per-device (`AsyncStorage`), not server-driven — a tournament won't show as "mine" on a different device or after reinstall (though it remains publicly findable via Explore) | Confirmed gap |
| Tournament match score updates | Backend endpoint is explicitly "speculative — not implemented yet"; app relies on a local override cache as the real source of truth | Confirmed gap |
| Subscription & One-Time Payment checkout | Uses a fake/simulated card form, NOT the real PayHere WebView used for match/trainer booking checkout | By design (inconsistency worth flagging to product) |
| Join Checkout / Trainer Checkout payment | Simulated (800ms delay), not a real gateway charge, even though match/booking Checkout IS real PayHere | By design (inconsistency worth flagging to product) |
| Forgot Password | Always shows a "sent" success state even for unregistered emails, by design (anti-enumeration) | By design |
| Google Sign-In | Can only ever create/use a `USER`-type account, never Vendor/Trainer | By design |
| Tournament team size | No server-side maximum enforced | Confirmed gap — confirm with product if a cap is expected |
