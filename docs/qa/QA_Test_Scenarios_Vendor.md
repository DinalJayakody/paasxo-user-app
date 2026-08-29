# Paasxo — Vendor App QA Test Scenarios

**App under test:** `vendor-app` (Expo/React Native), logged in as an account with `accountType = VENDOR`
**Backend:** `mobile-app-paasxo` (Spring Boot), shared by Vendor App, Trainer role, and the User App
**Companion documents:** `QA_Test_Scenarios_Trainer.md`, `QA_Test_Scenarios_User.md`

---

## 1. Scope

This document covers every screen and action available to a **Vendor** account in `vendor-app`: registration/login, creating and managing venues ("branches"), managing slot availability, accepting/rejecting booking requests, notifications, payments/earnings, subscription, and settings. It also includes negative tests, access-control tests, and cross-app integration tests where a Vendor's action must be reflected correctly in the User App (Paasxo customer app).

A Vendor account can own **multiple venues** under one login (there is no separate "branch" object — each venue created is an independent record, but for this test plan we treat "2 venues per vendor" as that vendor's two branches).

---

## 2. Test Data — Dummy Accounts (use these exact values across all 3 test documents for consistency)

### Vendors (3 vendors × 2 branches each)

| Vendor (login) | Business / Display Name | Email | Password | Phone | Branch A | Branch B |
|---|---|---|---|---|---|---|
| Vendor 1 | Nimal Perera — **Colombo Sports Hub** | `nimal.vendor@paasxotest.com` | `Test@1234` | +94 71 111 2222 | **Colombo Sports Hub – Colombo 05** (LKR 3000/slot, 06:00–23:00) | **Colombo Sports Hub – Nugegoda** (LKR 2500/slot, 07:00–22:00) |
| Vendor 2 | Saman Kumara — **Kandy Kickers Arena** | `saman.vendor@paasxotest.com` | `Test@1234` | +94 71 222 3333 | **Kandy Kickers – Central Court** (LKR 2800/slot, 06:00–22:00) | **Kandy Kickers – Peradeniya Court** (LKR 2200/slot, 08:00–21:00) |
| Vendor 3 | Ruwani Silva — **Galle Sports Zone** | `ruwani.vendor@paasxotest.com` | `Test@1234` | +94 71 333 4444 | **Galle Sports Zone – Fort Ground** (LKR 3200/slot, 06:00–23:00) | **Galle Sports Zone – Unawatuna Beach Court** (LKR 2600/slot, 07:00–22:00) |

All venues use **Futsal**, 60-minute slots, unless a test case says otherwise.

### Supporting accounts (from the other two documents, needed for cross-app tests)
- Normal users: **Ashan Perera, Dilshan Silva, Nadeesha Fernando, Chamara Jayasuriya, Ishara Rajapaksa** (see `QA_Test_Scenarios_User.md`)
- Trainers: **Kasun Fernando, Dilani Wijesekara, Roshan Silva** (see `QA_Test_Scenarios_Trainer.md`)

---

## 3. Legend

- **Priority:** High (core money/booking path) / Medium / Low
- **Screen names** are the actual in-app screen titles; **button/field labels** are quoted exactly as they appear in the UI.
- **[Known behavior]** marks a result that looks broken but is confirmed intentional or a confirmed stub — do not log these as new bugs, just verify they behave as described.
- **[Confirmed gap]** marks a missing feature that IS worth logging if found broken beyond what's described here.

---

## 4. Module 1 — Registration & Login

**TC-VEN-001 | Priority: High | Register a new Vendor account**
1. Open the app (logged out) → **Login** screen → tap **"Sign Up for free"**.
2. On **Register**, under **"I am a"**, select the **Vendor** card ("List venues & courts").
3. Optionally tap the avatar circle → pick a business logo from gallery.
4. Fill: Business/Manager Name = `Nimal Perera`, Email = `nimal.vendor@paasxotest.com`, Phone = `+94 71 111 2222`, Password = `Test@1234`, Confirm Password = `Test@1234`.
5. Under **"Sports you offer"**, select chip **Futsal**.
6. Tap **"Create Vendor Account"**.
- **Expected:** Registration succeeds immediately (no OTP/email verification/approval step — **[Known behavior]**), app navigates straight to **Dashboard** ("My Venues") logged in as the new vendor.

**TC-VEN-002 | Priority: High | Register second and third vendor accounts**
- Repeat TC-VEN-001 for Vendor 2 (Saman Kumara) and Vendor 3 (Ruwani Silva) using the data table above.
- **Expected:** Each account registers independently and lands on its own empty Dashboard.

**TC-VEN-003 | Priority: High | Sign in with valid vendor credentials**
1. On **Login**, enter email `nimal.vendor@paasxotest.com` and password `Test@1234`.
2. Tap **"Sign In"**.
- **Expected:** Navigates to **Dashboard**, header shows "Nimal Perera" / "Welcome back — here's your venue overview."

**TC-VEN-004 | Priority: Medium | Sign in with wrong password**
1. On **Login**, enter valid email, wrong password → tap **"Sign In"**.
- **Expected:** Alert **"Sign in failed"** with an error message; user remains on Login.

**TC-VEN-005 | Priority: Medium | Sign in with unregistered email**
1. Enter an email never registered → tap **"Sign In"**.
- **Expected:** Alert **"Sign in failed"**; no session created.

**TC-VEN-006 | Priority: Low | Empty-field validation on Login**
1. Leave email and password blank → tap **"Sign In"**.
- **Expected:** Client-side validation blocks submission (no crash, no network call for empty fields).

**TC-VEN-007 | Priority: Low | "Forgot password?" is a placeholder**
1. On Login, tap **"Forgot password?"**.
- **Expected: [Known behavior]** — shows a generic alert ("Hook up password-reset flow here.") and does nothing further. Do not expect an email or reset screen.

**TC-VEN-008 | Priority: Low | Google / Apple sign-in buttons are stubs**
1. On Login or Register, tap **"Google"** then **"Apple"**.
- **Expected: [Known behavior]** — both show a placeholder alert; no real social sign-in flow completes. Confirm neither creates a session nor crashes the app.

**TC-VEN-009 | Priority: Medium | Registration validation — password too short**
1. On Register, enter a password with fewer than 6 characters → submit.
- **Expected:** Inline/blocking validation error; account is not created.

**TC-VEN-010 | Priority: Medium | Registration validation — passwords don't match**
1. Enter Password ≠ Confirm Password → submit.
- **Expected:** Blocking validation error; account is not created.

**TC-VEN-011 | Priority: Medium | Registration validation — invalid email format**
1. Enter `nimal.vendor` (no domain) as email → submit.
- **Expected:** Blocking validation error.

**TC-VEN-012 | Priority: Medium | Duplicate email registration**
1. Try to register a new Vendor using an email already used by Vendor 1 (`nimal.vendor@paasxotest.com`).
- **Expected:** Registration fails with a server error surfaced to the user (e.g. "email already in use"); no duplicate account created.

**TC-VEN-013 | Priority: Low | Session persistence across app restart**
1. Sign in as Vendor 1 → force-close the app → reopen it.
- **Expected:** A brief splash/loading indicator appears while the session hydrates, then the app lands directly on **Dashboard** without asking to log in again.

**TC-VEN-014 | Priority: Medium | Log out**
1. From **Dashboard**, tap the logo (top right) → **Settings**.
2. Tap **"Log Out"** → confirm dialog → tap **"Log Out"** (destructive option).
- **Expected:** Returns to **Login** screen; relaunching the app does NOT auto-restore the session (session truly cleared, unlike the User App's broken logout — see `QA_Test_Scenarios_User.md`).

---

## 5. Module 2 — Dashboard ("My Venues")

**TC-VEN-015 | Priority: High | Empty Dashboard before any venue exists**
1. Sign in as a freshly-registered vendor with no venues.
- **Expected:** "My Venues" section shows empty state **"No venues yet"** with CTA **"+ Add Venue"**; Overview stat cards show zero bookings/revenue and **"Active Venues: 0 / 0"**.

**TC-VEN-016 | Priority: High | "Add New Venue" button navigates correctly**
1. From Dashboard header area, tap **"Add New Venue"**.
- **Expected:** Navigates to **Create Venue** screen with all fields empty.

**TC-VEN-017 | Priority: High | Dashboard lists all venues owned by the vendor**
1. As Vendor 1, after creating both branches (see Module 3), return to **Dashboard**.
- **Expected:** Two venue cards appear under "My Venues": "Colombo Sports Hub – Colombo 05" and "Colombo Sports Hub – Nugegoda", each showing cover image (or placeholder), **Active** status badge, price "LKR 3000/slot" / "LKR 2500/slot", and a "View on Map" location row.

**TC-VEN-018 | Priority: Medium | Venue card "Manage" button**
1. On a venue card, tap **"Manage"**.
- **Expected:** Navigates to **Venue Detail** for that specific venue (verify correct venue's name/data loads, not another venue's).

**TC-VEN-019 | Priority: Medium | Venue card pencil (edit) icon**
1. On a venue card, tap the pencil icon.
- **Expected:** Navigates to **Create Venue** in edit mode, pre-filled with that venue's existing data.

**TC-VEN-020 | Priority: Medium | Notification bell badge and navigation**
1. Trigger a booking request from a user (see cross-app section) so unread count > 0.
2. On Dashboard, observe the bell icon badge, then tap it.
- **Expected:** Badge shows correct unread count; tapping navigates to **Notifications** screen. Badge count refreshes automatically (polled ~every 15s).

**TC-VEN-021 | Priority: Medium | "Awaiting Your Decision" stat card**
1. With at least one PENDING_VENDOR booking on any venue, view Dashboard Overview section.
2. Tap the **"Awaiting Your Decision"** stat card.
- **Expected:** Card is visible only when pending count > 0 and shows the correct count; tapping it navigates to **Notifications**.

**TC-VEN-022 | Priority: Medium | "Total Bookings" and "Revenue" stat accuracy**
1. Accept 2 bookings worth LKR 3000 and LKR 2500 respectively (see Module 7) on Vendor 1's venues.
2. Return to Dashboard.
- **Expected:** "Total Bookings" reflects the accepted count; "Revenue" sums to LKR 5500 (only ACTIVE_MATCH bookings count toward revenue — cancelled/pending are excluded).

**TC-VEN-023 | Priority: Low | "Active Venues" ratio**
1. Deactivate no venues; confirm both of Vendor 1's venues show Active.
- **Expected:** "Active Venues" reads "2 / 2".

**TC-VEN-024 | Priority: Medium | "· View on Map" location link**
1. On a venue card, tap **"· View on Map"**.
- **Expected:** Opens the device's Google Maps app/browser at the venue's saved coordinates.

---

## 6. Module 3 — Create & Edit Venue (Branch)

**TC-VEN-025 | Priority: High | Create Branch A for Vendor 1 (Colombo Sports Hub – Colombo 05)**
1. From Dashboard tap **"Add New Venue"**.
2. Under **Sport**, select the **Futsal** card.
3. Tap the Cover Photo box → pick an image from gallery.
4. Venue Name = `Colombo Sports Hub – Colombo 05`.
5. Description = `Premium indoor futsal court in Colombo 05, floodlit, artificial turf.`
6. Price per Slot (LKR) = `3000`.
7. Operating Hours: Open = `06:00`, Close = `23:00`.
8. Tap **Location** → in the map picker, drop a pin in Colombo 05, confirm reverse-geocoded address/city looks correct.
9. Tap **"Create Venue"**.
- **Expected:** Success alert **"Venue created"** → returns to Dashboard; new venue card appears with Active status and correct price/hours. Backend auto-generates bookable time slots for this venue through year-end.

**TC-VEN-026 | Priority: High | Create Branch B for Vendor 1 (Colombo Sports Hub – Nugegoda)**
- Repeat TC-VEN-025 with Name=`Colombo Sports Hub – Nugegoda`, Price=`2500`, Hours `07:00–22:00`, pin in Nugegoda.
- **Expected:** Vendor 1's Dashboard now shows 2 venue cards.

**TC-VEN-027 | Priority: High | Create both branches for Vendor 2 and Vendor 3**
- Repeat the create-venue flow for Vendor 2 (Kandy Kickers – Central Court, Kandy Kickers – Peradeniya Court) and Vendor 3 (Galle Sports Zone – Fort Ground, Galle Sports Zone – Unawatuna Beach Court) using the data table in Section 2.
- **Expected:** Each vendor ends up with exactly 2 venues, visible only on their own Dashboard (not on other vendors' dashboards — see TC-VEN-131 for the cross-account isolation check).

**TC-VEN-028 | Priority: Medium | Validation — missing venue name**
1. Start Create Venue, fill all fields except Venue Name → tap **"Create Venue"**.
- **Expected:** Blocking validation error; venue is not created.

**TC-VEN-029 | Priority: Medium | Validation — price is zero or negative**
1. Enter Price per Slot = `0` (or a negative number) → submit.
- **Expected:** Blocking validation error ("price must be greater than 0" or similar).

**TC-VEN-030 | Priority: Medium | Validation — close time before open time**
1. Set Open = `20:00`, Close = `08:00` → submit.
- **Expected:** Blocking validation error preventing an invalid operating window.

**TC-VEN-031 | Priority: Medium | Validation — location not selected**
1. Fill all fields but skip the Location picker → submit.
- **Expected:** Blocking validation error; venue not created without coordinates.

**TC-VEN-032 | Priority: Low | Sport selector is cosmetic only**
1. Create two venues with the same details but different Sport selection (e.g. Futsal vs Cricket).
- **Expected: [Known behavior]** — the chosen sport does not change any backend behavior (no sport field is actually stored); it only affects the card's cosmetic gradient/icon. Confirm this doesn't block booking flows for either.

**TC-VEN-033 | Priority: High | Edit an existing venue's price**
1. From Dashboard, tap the pencil icon on "Colombo Sports Hub – Colombo 05".
2. Change Price per Slot from `3000` to `3500`.
3. Tap **"Save Changes"**.
- **Expected:** Alert **"Venue updated"**; Dashboard card now shows "LKR 3500/slot"; future/available slots reflect the new price, but already-booked slots keep their original historical price on existing bookings.

**TC-VEN-034 | Priority: Medium | Edit operating hours extends slot generation**
1. Edit "Colombo Sports Hub – Nugegoda", change Close time from `22:00` to `23:00` → Save.
2. Go to **Manage Availability** for that venue on a future date.
- **Expected:** A new slot for `22:00–23:00` appears as AVAILABLE (backfilled) without disturbing existing slots earlier in the day.

**TC-VEN-035 | Priority: Medium | Edit venue name and description**
1. Edit any venue's Name and Description text → Save.
- **Expected:** Both changes persist and display correctly on Dashboard card and Venue Detail.

**TC-VEN-036 | Priority: Medium | Change cover photo**
1. Edit a venue, tap the cover photo, replace with a different image → Save.
- **Expected:** New image displays on both Dashboard card and Venue Detail hero.

**TC-VEN-037 | Priority: Medium | Change venue location via map**
1. Edit a venue, reopen the Location picker, move the pin to a new spot → Save.
- **Expected:** Updated coordinates persist; "View on Map" opens the new location.

**TC-VEN-038 | Priority: Low | Cancel out of Create Venue without saving**
1. Start filling in Create Venue, then navigate back (device/back arrow) before tapping Create.
- **Expected:** No venue is created; Dashboard is unchanged.

**TC-VEN-039 | Priority: Medium | Create a third venue under the same vendor**
1. As Vendor 1 (already has 2 venues), create a third venue "Colombo Sports Hub – Rajagiriya".
- **Expected:** Confirms there's no hard 2-venue cap — Dashboard now shows 3 venue cards for Vendor 1. (Delete/deactivate this extra venue afterward if a clean 2-branch dataset is needed for later tests — there is no delete-venue UI, so leaving it Inactive via editing, if supported, is the only cleanup path; otherwise note it as permanent test data.)

**TC-VEN-040 | Priority: Low | No amenities/gallery management exists**
1. Look through Create/Edit Venue and Venue Detail for any multi-image gallery or amenities checklist.
- **Expected: [Known behavior]** — none exists; only a single cover image per venue. Confirm no crash when looking for such a feature.

---

## 7. Module 4 — Venue Detail Screen

**TC-VEN-041 | Priority: High | Venue Detail shows correct description and facts**
1. From Dashboard, tap **"Manage"** on "Kandy Kickers – Central Court".
- **Expected:** Hero image, **"Venue Description"** card with correct text, fact chips for price/slot-duration and open–close hours (`06:00–22:00`) all match what was configured.

**TC-VEN-042 | Priority: Medium | "Edit Info" link on Venue Detail**
1. On Venue Detail, tap **"Edit Info"**.
- **Expected:** Navigates to **Create Venue** in edit mode for this exact venue.

**TC-VEN-043 | Priority: High | Live Status reflects real slot availability**
1. On Venue Detail for a venue with all of today's slots open, check the **"Live Status"** card.
- **Expected:** Shows **ACTIVE** pill with pulsing dot and "{available} of {total} slots open today" with correct numbers.

**TC-VEN-044 | Priority: Medium | Live Status prompts slot generation when none exist**
1. View Venue Detail for a venue where today's slots were never generated (e.g. far-future date not yet backfilled).
- **Expected:** Prompts to generate slots rather than showing a false "0 of 0" state.

**TC-VEN-045 | Priority: High | "Upcoming Bookings" card lists correct bookings**
1. Create/accept 2 bookings for "Kandy Kickers – Central Court" dated in the future.
2. View Venue Detail's **"Upcoming Bookings"** card.
- **Expected:** Shows up to 5 non-cancelled future bookings with date badge, title/sport, time range, and price; cancelled bookings are excluded.

**TC-VEN-046 | Priority: Low | "Upcoming Bookings" empty state**
1. View Venue Detail for a venue with zero future bookings.
- **Expected:** Shows **"No upcoming bookings"**.

**TC-VEN-047 | Priority: High | "Manage Availability" button navigates correctly**
1. On Venue Detail, tap **"Manage Availability"**.
- **Expected:** Opens **Manage Availability** scoped to this exact venue (verify venue name/date header matches).

**TC-VEN-048 | Priority: Medium | Edit (pencil) FAB on Venue Detail hero**
1. Tap the pencil FAB on the hero image.
- **Expected:** Same destination and behavior as TC-VEN-042 ("Edit Info").

---

## 8. Module 5 — Manage Availability (Slots, Blocking, Closing Days, Walk-in Bookings)

**TC-VEN-049 | Priority: High | Generate slots for a venue on first use**
1. Open **Manage Availability** for a venue/date where no slots exist yet.
2. Tap **"Generate Slots"**.
- **Expected:** Slots are created for that date, grouped into **"MORNING SLOTS" / "AFTERNOON SLOTS" / "EVENING SLOTS"**, matching the venue's configured hours and 60-minute duration, all marked AVAILABLE.

**TC-VEN-050 | Priority: Medium | "Change" date picker**
1. Tap **"Change"** (calendar icon) in the Manage Availability header.
2. Pick a date one week out.
- **Expected:** Header date updates; the slot grid reloads for the newly selected date.

**TC-VEN-051 | Priority: High | Select multiple AVAILABLE slots**
1. Tap 3 different AVAILABLE slot tiles in sequence.
- **Expected:** Each tap toggles multi-select highlighting; a floating bar appears reading **"3 selected ✕"** with **"Block"** and **"Book Selected"** buttons.

**TC-VEN-052 | Priority: Medium | Deselect via the "✕" in the floating bar**
1. With slots selected, tap the **"✕"** in the floating selection bar.
- **Expected:** Selection clears; floating bar disappears.

**TC-VEN-053 | Priority: High | Bulk "Block" selected slots**
1. Select 2 AVAILABLE slots → tap **"Block"**.
2. In the modal, enter reason `Court maintenance` → tap **"Confirm Block"**.
- **Expected:** Both slots now show status **BLOCKED**; tapping either slot afterward opens the single-slot action modal with **"Reopen Slot"** as the only action.

**TC-VEN-054 | Priority: High | Bulk "Book Selected" (walk-in/phone booking)**
1. Select 2 AVAILABLE slots → tap **"Book Selected"**.
2. In the "Book 2 slot(s)" modal, enter Customer name = `Walk-in Customer - Kamal` (optional field) → tap **"Submit & Mark Booked"**.
- **Expected:** Slots immediately show status **BOOKED** / a "WALK-IN" tag; a new booking is created directly in **ACTIVE_MATCH** state with no approval step and `paymentStatus = NOT_APPLICABLE`. It appears on the **Bookings** tab tagged "· Walk-in" and counts toward Dashboard "Total Bookings"/"Revenue".

**TC-VEN-055 | Priority: Medium | "Book Selected" without entering a customer name**
1. Select a slot → **"Book Selected"** → leave Customer name blank → **"Submit & Mark Booked"**.
- **Expected:** Booking is still created successfully (name field is optional).

**TC-VEN-056 | Priority: High | Single-slot action modal — BOOKED slot cancel**
1. Tap a BOOKED slot (from TC-VEN-054) → in the modal tap **"Cancel Booking & Reopen"**.
- **Expected:** Booking moves to CANCELLED; the slot returns to AVAILABLE and is immediately re-bookable.

**TC-VEN-057 | Priority: Medium | Single-slot action modal — BLOCKED slot reopen**
1. Tap a BLOCKED slot (from TC-VEN-053) → tap **"Reopen Slot"**.
- **Expected:** Slot returns to AVAILABLE.

**TC-VEN-058 | Priority: High | "Close Full Day"**
1. On a date with no existing bookings, tap **"Close Full Day"**.
- **Expected:** Card switches to "Full day closed — {reason}"; all of that date's slots become unbookable for customers in the User App; button changes to **"Reopen Day"**.

**TC-VEN-059 | Priority: Medium | "Reopen Day" after closing**
1. From the closed state, tap **"Reopen Day"**.
- **Expected:** Card reverts to "Venue is open on this date"; previously-generated slots for that date become bookable again.

**TC-VEN-060 | Priority: High | Cannot directly force a slot to BOOKED/PENDING via block-status API**
1. Attempt (via any UI path) to set an AVAILABLE slot straight to a "booked-looking" state without going through Book/Accept.
- **Expected:** Not possible from the UI — confirms the backend rule that only the booking endpoints (not the generic status-update endpoint) may move a slot to BOOKED/PENDING_VENDOR. UI naturally enforces this by only offering Block/Book actions.

**TC-VEN-061 | Priority: High | Cannot block a slot that is BOOKED or PENDING_VENDOR without resolving the booking first**
1. Tap a slot currently in PENDING_VENDOR status (created via cross-app test in Module 13) directly (not via Bookings tab).
- **Expected:** Modal only offers **"Accept Request"/"Reject Request"**, not a generic Block option — confirms you must resolve the pending booking before the slot can be blocked.

**TC-VEN-062 | Priority: High | Generate slots for Branch B and Branch A independently**
1. Repeat slot generation (TC-VEN-049) for both branches of all 3 vendors, for at least 3 upcoming dates each.
- **Expected:** Each venue's slots are independent — generating/blocking/booking on one branch never affects the other branch's slot grid.

**TC-VEN-063 | Priority: Medium | Slot uniqueness — no duplicate slot at same venue/date/time**
1. Attempt to generate slots twice in a row for the same venue/date.
- **Expected:** No duplicate slots appear (generation is idempotent by start/end time); slot count stays the same.

**TC-VEN-064 | Priority: Medium | Hint text guidance is accurate**
1. Read the hint: "Only need part of the day? Tap the available slots below to select a time range, then Block or Book them."
2. Follow it literally: select a contiguous time range and Book it.
- **Expected:** Behaves as described — matches actual UI behavior.

**TC-VEN-065 | Priority: Low | Slot grid grouping by time-of-day**
1. Generate a full day's slots for a venue open 06:00–23:00.
- **Expected:** Slots before 12:00 appear under "MORNING SLOTS", 12:00–17:00 under "AFTERNOON SLOTS", after 17:00 under "EVENING SLOTS" (verify boundary slots land in the expected group).

**TC-VEN-066 | Priority: Medium | Block reason is optional**
1. Select a slot → Block → leave the reason field blank → **"Confirm Block"**.
- **Expected:** Block succeeds without a reason; slot shows BLOCKED with no reason text (or a generic label).

**TC-VEN-067 | Priority: Medium | Blocked-day reason is shown to customers as venue-closed**
1. Close a full day with reason `Private event`.
2. In the User App, attempt to browse/book that venue for the closed date (see `QA_Test_Scenarios_User.md`, cross-app section).
- **Expected:** No bookable slots are shown for that date in the User App.

**TC-VEN-068 | Priority: Medium | Booking a slot too close to closing time boundary**
1. Attempt to book the very last slot before Close time (e.g. `22:00–23:00` on a venue closing at 23:00).
- **Expected:** Slot is generated and bookable normally; no off-by-one error excludes the final slot.

**TC-VEN-069 | Priority: Low | Multi-slot selection across a gap (non-contiguous)**
1. Select slot `08:00`, skip `09:00`, select `10:00` → Book Selected.
- **Expected:** Both non-contiguous slots book successfully as 2 separate walk-in bookings/slots tied to one booking record; verify the booking's time display is sensible (not misleadingly shown as one continuous block).

**TC-VEN-070 | Priority: Medium | Vendor books a slot for one branch, verify it's isolated from the other vendor's data**
1. As Vendor 1, book a walk-in slot on "Colombo Sports Hub – Colombo 05".
2. Sign in as Vendor 2, check Dashboard/Bookings.
- **Expected:** Vendor 2 sees none of Vendor 1's bookings or venues (strict per-vendor data isolation).

**TC-VEN-071 | Priority: Medium | Blocking a slot with a very long reason string**
1. Enter a long (200+ character) reason when blocking a slot.
- **Expected:** Accepted and displayed without breaking layout, or gracefully truncated — no crash.

**TC-VEN-072 | Priority: Low | Rapid repeated taps on "Confirm Block"/"Submit & Mark Booked"**
1. Double/triple-tap the confirm button quickly.
- **Expected:** No duplicate bookings/blocks created (idempotent submit or button disables after first tap).

**TC-VEN-073 | Priority: Medium | Generate slots far in the future (e.g. December 31 of current year)**
1. Navigate the date picker to the last day of the current year.
2. Generate slots.
- **Expected:** Slots generate correctly (backend generates through end of current year); confirm behavior/error messaging for a date beyond that boundary, e.g. next January 1.

**TC-VEN-074 | Priority: Low | Generate slots for a past date**
1. Try to navigate the date picker to a date before today.
- **Expected:** Date picker prevents selecting past dates, or if selected, no meaningful booking actions are available for a past slot.

**TC-VEN-075 | Priority: Medium | Slot status labels are accurate at a glance**
1. Create one slot in each state: AVAILABLE, BOOKED (via walk-in), BLOCKED, PENDING_VENDOR (via cross-app customer booking).
- **Expected:** Each tile clearly displays its correct status label (AVAILABLE/BOOKED/BLOCKED/"REQUEST PENDING"/"WALK-IN") with distinct styling/color.

---

## 9. Module 6 — Bookings List

**TC-VEN-076 | Priority: High | Bookings tab shows aggregated bookings across both branches**
1. Have at least one booking on each of Vendor 1's two branches.
2. Open the **Bookings** tab.
- **Expected:** Header subtitle shows correct "{total} total · {pending} awaiting review"; list includes bookings from BOTH branches in one feed.

**TC-VEN-077 | Priority: Medium | Filter chip — All**
1. Tap filter chip **"All"**.
- **Expected:** Shows every non-cancelled booking across all venues.

**TC-VEN-078 | Priority: Medium | Filter chip — Pending**
1. Tap **"Pending"**.
- **Expected:** Only PENDING_VENDOR bookings shown, each with hint "Tap to review and accept/reject".

**TC-VEN-079 | Priority: Medium | Filter chip — Active**
1. Tap **"Active"**.
- **Expected:** Only ACTIVE_MATCH bookings shown, each with an inline **"Cancel"** button.

**TC-VEN-080 | Priority: Medium | Filter chip — Cancelled**
1. Tap **"Cancelled"**.
- **Expected:** Only CANCELLED bookings shown (rejected, vendor-cancelled, or user-cancelled).

**TC-VEN-081 | Priority: High | Tapping a Pending booking card opens the review modal**
1. Tap a card with status PENDING_VENDOR.
- **Expected:** Opens **Booking Request Detail** modal for that exact booking.

**TC-VEN-082 | Priority: High | Inline "Cancel" on an Active booking**
1. On an ACTIVE_MATCH card, tap the inline **"Cancel"** button → confirm.
- **Expected:** Booking moves to CANCELLED, slot(s) reopen to AVAILABLE, and (if it was paid) a refund is triggered.

**TC-VEN-083 | Priority: Low | Empty state per filter**
1. Apply a filter with zero matching bookings (e.g. "Cancelled" on a fresh account).
- **Expected:** Shows **"No bookings here"**.

**TC-VEN-084 | Priority: Medium | Walk-in tag visibility**
1. Locate a walk-in booking created in Module 5.
- **Expected:** Card shows the **"· Walk-in"** tag next to the title/sport.

**TC-VEN-085 | Priority: Medium | Booking list reflects both PayHere-paid and walk-in bookings side by side**
1. Have one customer-paid booking and one walk-in booking simultaneously.
- **Expected:** Both display correctly with accurate price/status; no mixing of data between them.

---

## 10. Module 7 — Booking Request Accept / Reject

> Precondition for this module: a normal User (e.g. Ashan Perera) has created and paid for a match booking against one of the vendor's venues (see `QA_Test_Scenarios_User.md`, Match Flow), putting it into PENDING_VENDOR with `paymentStatus = PAID`.

**TC-VEN-086 | Priority: High | Open Booking Request Detail from Notifications**
1. Open **Notifications**, tap a "New booking request" item.
- **Expected:** Opens **Booking Request Detail** modal (hero orange, pill **"AWAITING YOUR DECISION"**), correct organizer name, match title/sport, date & time, venue, and "Total value" price.

**TC-VEN-087 | Priority: High | Accept a fully-paid booking request**
1. On Booking Request Detail, tap **"Accept Request"**.
- **Expected:** Hero turns green, headline **"Request Accepted"**, **"Done"** button appears. Booking flips to ACTIVE_MATCH; slot(s) flip to BOOKED. The organizer receives a BOOKING_CONFIRMED notification. Tap **"Done"** to close the modal.

**TC-VEN-088 | Priority: High | Reject a booking request with a reason**
1. On a different pending request, tap **"Reject"**.
2. Enter Reason = `Court under maintenance` → tap **"Confirm Reject"**.
- **Expected:** Hero turns red, headline **"Request Declined"**. Booking flips to CANCELLED, slot(s) return to AVAILABLE. The organizer receives a BOOKING_REJECTED notification including the reason, and (since it was paid) a refund is initiated (REFUND_PENDING → REFUNDED).

**TC-VEN-089 | Priority: Medium | Reject without entering a reason**
1. Tap **"Reject"** → leave the reason field empty → **"Confirm Reject"**.
- **Expected:** Rejection succeeds (reason is optional); organizer's notification shows no specific reason or a generic one.

**TC-VEN-090 | Priority: Medium | "Back" cancels out of the reject flow**
1. Tap **"Reject"**, type a reason, then tap **"Back"** instead of confirming.
- **Expected:** Returns to the pending state with **"Accept Request"/"Reject"** still available; nothing is changed.

**TC-VEN-091 | Priority: High | Cannot accept a booking that hasn't been paid yet**
1. Using a test/staging setup where a booking is PENDING_VENDOR but the customer never completed payment (`paymentStatus != PAID` and not a walk-in), attempt to accept it.
- **Expected:** Accept fails with an error to the effect of "payment has not been confirmed for this booking yet" — vendor cannot bypass payment. (If dummy-mode payment makes this hard to reproduce from the UI, verify at minimum that the app doesn't silently show success for an unpaid booking.)

**TC-VEN-092 | Priority: Medium | Booking Request Detail from a slot tap in Manage Availability**
1. In **Manage Availability**, tap a PENDING_VENDOR-status slot directly.
- **Expected:** Opens the same **Booking Request Detail** modal with matching data, confirming both entry points converge on the same booking.

**TC-VEN-093 | Priority: Medium | Accept/Reject buttons disappear after a decision is made**
1. Reopen an already-decided (accepted or rejected) booking's detail via Bookings list.
- **Expected:** No Accept/Reject controls are shown for a booking no longer in PENDING_VENDOR state (screen should reflect the resolved state or simply not allow a second decision).

**TC-VEN-094 | Priority: Medium | Multi-slot booking request review**
1. Have a customer book 2 consecutive slots as one match (see User App test), then review it here.
- **Expected:** Detail modal's "DATE & TIME" row indicates the slot count (">1 slot"), and Accept/Reject applies to all slots in that booking atomically.

**TC-VEN-095 | Priority: High | Accepting a request immediately updates the Bookings tab and Dashboard stats**
1. Accept a pending request → navigate to **Bookings** tab, then **Dashboard**.
- **Expected:** Booking now shows under "Active" filter; Dashboard "Total Bookings" and "Revenue" update to include it.

**TC-VEN-096 | Priority: High | Rejecting a request frees the slot for a new booking**
1. Reject a pending request for slot `18:00–19:00` on a given date.
2. In Manage Availability for that date, check the slot.
- **Expected:** Slot shows AVAILABLE again and can be booked/blocked immediately by the vendor or booked by another customer.

**TC-VEN-097 | Priority: Medium | Vendor cannot see or act on another vendor's pending requests**
1. As Vendor 2, check Notifications/Bookings for any request created against Vendor 1's venue.
- **Expected:** Nothing appears — requests are strictly scoped to the owning vendor.

**TC-VEN-098 | Priority: Low | Booking Request Detail price matches server-calculated total**
1. Compare the "Total value" shown in the modal against (venue price/slot × number of slots) for that booking.
- **Expected:** Matches exactly — price is server-computed and cannot have been altered by the customer client-side.

**TC-VEN-099 | Priority: Medium | Reject a request right at match start time (edge of expiry)**
1. Attempt to Accept/Reject a pending request whose match start time has already passed.
- **Expected:** Verify whether the app blocks the decision (expired) or still allows it — document actual behavior since this is an edge case not explicitly covered by vendor-side validation.

**TC-VEN-100 | Priority: Medium | Notification created for the customer on every decision**
1. Accept one request and reject another (different bookings).
2. In the User App as the relevant customers, check Notifications.
- **Expected:** Ashan (accepted) sees a "Booking Confirmed" notification; the rejected organizer sees a "Booking Rejected" notification with the reason if provided.

---

## 11. Module 8 — Notifications

**TC-VEN-101 | Priority: High | Notifications list shows correct unread count**
1. Generate 3 unread notifications (e.g. 3 booking requests across both branches).
2. Open **Notifications**.
- **Expected:** Subtitle reads "3 unread"; each unread item shows an unread dot indicator.

**TC-VEN-102 | Priority: Medium | Tapping a notification marks it read**
1. Tap any unread notification card.
- **Expected:** Item's unread dot disappears; unread count decreases by 1 on the bell badge.

**TC-VEN-103 | Priority: High | Tapping a booking-approval notification routes to the right booking**
1. Tap a "BOOKING_PENDING_VENDOR_APPROVAL" notification.
- **Expected:** Opens **Booking Request Detail** for the exact correct `bookingId` referenced.

**TC-VEN-104 | Priority: Medium | "Mark all read"**
1. With several unread notifications, tap **"Mark all read"**.
- **Expected:** All items lose their unread dot; subtitle changes to "You're all caught up"; button disappears (only shown when unread > 0).

**TC-VEN-105 | Priority: Low | Empty notifications state**
1. View Notifications for a brand-new vendor account.
- **Expected:** Shows **"No notifications yet"**.

**TC-VEN-106 | Priority: Low | Relative timestamps**
1. Check notifications created moments ago vs. hours/days ago.
- **Expected:** Displays "Xm ago" / "Xh ago" / "Xd ago" correctly.

**TC-VEN-107 | Priority: Medium | Notifications refresh automatically**
1. Leave the Notifications screen open; from another device/account, trigger a new booking request against this vendor.
2. Wait ~15 seconds without manually refreshing.
- **Expected:** New notification and updated unread count appear automatically (polling).

**TC-VEN-108 | Priority: Low | Notifications are scoped per vendor account**
1. Compare Notifications between Vendor 1 and Vendor 2 after activity on both.
- **Expected:** Each vendor only sees notifications relevant to their own venues/bookings.

---

## 12. Module 9 — Payment History / Earnings

**TC-VEN-109 | Priority: Medium | Payment History shows Total Revenue**
1. Open **Payments** tab.
- **Expected:** **"Total Revenue"** stat card shows a LKR amount; note this screen is flagged in code as **[Confirmed gap]** — the backing endpoints may not be fully wired on the live backend, so a blank/zero/error state here should be reported precisely (screenshot + network response) rather than assumed to be a simple UI bug.

**TC-VEN-110 | Priority: Low | "Daily Booking Efficiency" bar**
1. On Payments tab, check the efficiency progress bar.
- **Expected:** Displays a percentage with an animated fill; verify it doesn't crash or show NaN%.

**TC-VEN-111 | Priority: Medium | Filter chips — All / Paid / Pending / Failed**
1. Tap each of **"All Transactions"**, **"Paid"**, **"Pending"**, **"Failed"**.
- **Expected:** List filters accordingly; note there is no dedicated "Refunded" chip even though REFUNDED is a valid status — confirm refunded transactions still appear somewhere reasonable (likely under "All").

**TC-VEN-112 | Priority: Low | Transaction row detail accuracy**
1. Compare a transaction row (customer name, sport, date range, amount) against the actual booking it corresponds to.
- **Expected:** All fields match.

**TC-VEN-113 | Priority: Low | Empty state**
1. View Payments on a vendor with zero transactions.
- **Expected:** Shows **"No transactions"**.

**TC-VEN-114 | Priority: Low | Footer count accuracy**
1. Check the "Showing {n} of {total} transactions" footer against the actual list length.
- **Expected:** Numbers are consistent and update correctly when filters change.

**TC-VEN-115 | Priority: Medium | Payments tab is shared identically for Vendor and Trainer roles**
1. Compare the Payments tab UI/behavior for a Vendor account vs a Trainer account (see Trainer document).
- **Expected:** Same screen/component; only the underlying transaction data differs per account.

---

## 13. Module 10 — Subscription & Billing

**TC-VEN-116 | Priority: Medium | Navigate to Subscription from Settings**
1. Settings → tap **"Subscription & Billing"**.
- **Expected:** Opens **Subscription** screen showing "Pro Plan" / "Monthly Billing" order summary (LKR 29.00 total, hardcoded).

**TC-VEN-117 | Priority: Medium | Select each payment method radio**
1. Tap **Credit / Debit Card**, then **Google Pay**, then **Apple Pay**.
- **Expected:** Selection UI updates correctly; Card option reveals Cardholder Name/Card Number/MM-YY/CVC fields, the other two do not.

**TC-VEN-118 | Priority: Medium | Complete a subscription payment (Card)**
1. Select Credit/Debit Card, fill in dummy card details, tap **"Complete Payment"**.
- **Expected: [Confirmed gap]** — code marks `vendor/subscription/checkout` as unverified against the real backend; expect to document whatever actually happens (success screen, silent failure, or network error) rather than assuming a specific outcome. Log a precise bug report with the exact response if it fails.

**TC-VEN-119 | Priority: Low | Card field formatting/validation**
1. Enter invalid card data (letters in card number, expired MM/YY) and attempt to submit.
- **Expected:** Client-side validation blocks obviously invalid input, if implemented; otherwise note as a gap.

**TC-VEN-120 | Priority: Low | Subscription screen is reachable for Trainer accounts too**
1. As a Trainer account, check whether Settings links to Subscription the same way.
- **Expected:** The route exists in the Trainer stack but confirm there is a discoverable path to reach it (per research notes, discoverability for trainers was flagged as worth checking).

**TC-VEN-121 | Priority: Low | "256-bit SSL encryption" footer text displays**
1. Scroll to the bottom of the Subscription screen.
- **Expected:** Footer disclaimer text renders correctly, no layout overflow.

**TC-VEN-122 | Priority: Low | Back navigation from Subscription**
1. From Subscription, use the back gesture/button.
- **Expected:** Returns cleanly to Settings without losing any unrelated app state.

---

## 14. Module 11 — Settings

**TC-VEN-123 | Priority: Medium | Profile card shows correct account info**
1. Open Settings.
- **Expected:** Avatar (or business-icon placeholder), display name, email, and phone (if set) all match the registered vendor account.

**TC-VEN-124 | Priority: High | No "Edit Profile" option exists for Vendor role**
1. Search Settings for any way to edit business name/email/phone/avatar post-registration.
- **Expected: [Known behavior]** — no such screen exists for the Vendor role (only Trainers get `EditTrainerProfileScreen`). Confirm this is indeed absent and not just hard to find, and consider logging as a product gap if the business expects vendors to be able to update their own account details.

**TC-VEN-125 | Priority: Low | "Notification Preferences" row is a stub**
1. Tap **"Notification Preferences"**.
- **Expected: [Known behavior]** — shows a "Coming soon" alert only.

**TC-VEN-126 | Priority: Low | "Staff Management" row is a stub**
1. Tap **"Staff Management"**.
- **Expected: [Known behavior]** — shows a "Coming soon" alert only; no staff-invite screen exists anywhere in the app despite the row being visible.

**TC-VEN-127 | Priority: Low | "Help & Support" row is a stub**
1. Tap **"Help & Support"**.
- **Expected: [Known behavior]** — shows an alert with `support@paasxo.com`, no real FAQ/support screen.

**TC-VEN-128 | Priority: High | "Log Out" confirmation dialog**
1. Tap **"Log Out"**.
- **Expected:** Confirmation dialog appears with **Cancel** and **Log Out** (destructive) options; **Cancel** dismisses without logging out.

**TC-VEN-129 | Priority: High | "Log Out" actually clears the session (contrast with User App bug)**
1. Tap **"Log Out"** → confirm.
2. Force-close and reopen the app.
- **Expected:** Lands back on **Login**, not auto-restored to Dashboard — confirms the Vendor App's logout is implemented correctly (this is the opposite of a known bug in the User App's Settings screen — see that document).

**TC-VEN-130 | Priority: Low | Settings screen is visually/functionally identical for Trainer accounts**
1. Compare Settings for Vendor vs Trainer login.
- **Expected:** Same shared component; only the profile card's underlying data differs.

---

## 15. Module 12 — Negative Tests, Access Control & Cross-Role Checks

**TC-VEN-131 | Priority: High | Vendor cannot see another vendor's venues or bookings**
1. As Vendor 2, inspect Dashboard, Bookings, Notifications, Payments.
- **Expected:** Zero visibility into Vendor 1's or Vendor 3's venues, bookings, or notifications.

**TC-VEN-132 | Priority: High | A plain "normal User" account cannot access vendor screens**
1. If technically possible (e.g. via a shared test build or by observing behavior if a USER-type account somehow reaches vendor-app), verify that vendor-only actions are rejected.
- **Expected:** Backend rejects with an error (there is no centralized role-based security — each vendor-only service method manually checks `accountType == VENDOR` — so this is worth spot-checking per critical action: create venue, accept booking, view vendor bookings).

**TC-VEN-133 | Priority: Medium | Expired/invalid auth token is handled gracefully**
1. Force an expired session (e.g. wait out a long-lived test token, or manipulate stored token if testable) and perform an action.
- **Expected:** App attempts a silent token refresh; if that fails, user is redirected to Login rather than the app crashing or showing raw error JSON.

**TC-VEN-134 | Priority: Medium | Poor/lost network during Accept/Reject**
1. Enable airplane mode mid-way through tapping "Accept Request".
- **Expected:** A clear error/retry message is shown; booking state is not left ambiguous (verify by reloading once back online — status matches what actually happened server-side, not a false-positive success).

**TC-VEN-135 | Priority: Medium | Concurrent accept attempts on the same booking (two vendor sessions)**
1. Open the same PENDING_VENDOR booking's detail on two devices/sessions logged in as the same vendor.
2. Tap Accept on both at nearly the same time.
- **Expected:** Only one succeeds cleanly; the second either shows an already-resolved state or a sensible error — no duplicate/contradictory state.

**TC-VEN-136 | Priority: Medium | Double-booking race: two customers book the same slot at once**
1. Coordinate two normal-user test devices to both attempt booking the exact same AVAILABLE slot simultaneously.
- **Expected:** Only one booking succeeds; the other receives a "slot no longer available" error, and the vendor never sees two conflicting PENDING_VENDOR requests for the same slot.

**TC-VEN-137 | Priority: Low | Very long venue name/description**
1. Enter an extremely long string (500+ characters) into Venue Name/Description.
- **Expected:** Either constrained by a max-length input or gracefully handled/truncated in display — no layout break or crash.

**TC-VEN-138 | Priority: Low | Special characters/emoji in venue name**
1. Create a venue named `Colombo ⚽ Sports Hub #1!`.
- **Expected:** Saves and displays correctly across Dashboard, Venue Detail, and Bookings.

**TC-VEN-139 | Priority: Medium | App behavior when the backend/API is unreachable**
1. Point the app at an unreachable backend (or simulate via airplane mode) and attempt to load Dashboard.
- **Expected:** Clear loading/error state, no infinite spinner or crash; retry works once connectivity returns.

**TC-VEN-140 | Priority: Low | Rotating/backgrounding the app mid-flow (Create Venue, Accept/Reject)**
1. Background the app mid-way through filling Create Venue or the reject-reason flow, then foreground it again.
- **Expected:** In-progress form state is preserved (or the app degrades gracefully back to a sane screen) — no crash or data loss beyond what's reasonable to expect.

---

## 16. Module 13 — Cross-App Integration (Vendor App ↔ User App)

> These tests require running both `vendor-app` and the customer app (`Paasxo-main`) side by side. Use the User App test data from `QA_Test_Scenarios_User.md`.

**TC-VEN-141 | Priority: High | Newly created venue appears immediately in the User App's venue search**
1. As Vendor 1, create "Colombo Sports Hub – Colombo 05" and generate today's slots.
2. In the User App, sign in as Ashan Perera → **Explore** → category **Venues**, search near Colombo.
- **Expected:** The new venue appears with matching name, price, and available slots.

**TC-VEN-142 | Priority: High | User creates a match booking → Vendor receives a pending request**
1. As Ashan Perera in the User App, create a match at "Colombo Sports Hub – Colombo 05" for a specific slot and complete payment (see User document, Match Flow).
2. As Vendor 1, check Notifications and Bookings.
- **Expected:** A new PENDING_VENDOR booking/notification appears for Vendor 1 with Ashan as organizer, correct slot/time/price.

**TC-VEN-143 | Priority: High | Vendor accepts → User sees "Booking Confirmed"**
1. Continue from TC-VEN-142: Vendor 1 taps **"Accept Request"**.
2. As Ashan, check the User App's **Booking Status** screen / Notifications.
- **Expected:** Ashan sees a "Booking Confirmed!" state and a BOOKING_CONFIRMED notification; the match becomes visible to other users as an ACTIVE_MATCH (joinable/public).

**TC-VEN-144 | Priority: High | Vendor rejects → User sees rejection + refund**
1. As Nadeesha Fernando (User), create+pay for a booking at "Kandy Kickers – Central Court".
2. As Vendor 2, reject it with a reason.
3. As Nadeesha, check Notifications and payment status.
- **Expected:** Nadeesha receives BOOKING_REJECTED with the reason; her payment moves toward REFUNDED (verify via Payment status endpoint/UI if exposed).

**TC-VEN-145 | Priority: Medium | Vendor blocks/closes a date → not bookable by any user**
1. As Vendor 3, close a full day on "Galle Sports Zone – Fort Ground".
2. As Chamara Jayasuriya (User), try to browse/book that venue for the closed date.
- **Expected:** No slots are offered for that date in the User App.

**TC-VEN-146 | Priority: Medium | Vendor cancels an already-active booking → user notified**
1. As Vendor 1, cancel an ACTIVE_MATCH booking from the Bookings tab.
2. As the organizing user, check Notifications.
- **Expected:** User receives a cancellation notification (e.g. MATCH_CANCELLED_NOTIFY) and, if the match had joiners, they're notified too; refund initiated if paid.

**TC-VEN-147 | Priority: Medium | Vendor walk-in booking does not require any User App action**
1. As Vendor 2, create a walk-in booking directly in Manage Availability.
2. Confirm no User App account is required and no PENDING_VENDOR step occurs.
- **Expected:** Booking is immediately ACTIVE_MATCH with `paymentStatus = NOT_APPLICABLE`; it still shows correctly on Vendor's Bookings tab and counts toward Revenue, but is not associated with a real customer account/notification.

**TC-VEN-148 | Priority: Medium | Vendor-approval timeout auto-refund (if testable within a reasonable window)**
1. As a User, pay for a booking and leave it PENDING_VENDOR without any vendor action for the configured timeout window (ask the dev team for the current `payhere.vendor-approval-timeout-hours` value, or use a lowered test-environment value).
- **Expected:** The reconciliation job auto-refunds the payment and the booking auto-cancels once the timeout elapses; verify both the User's payment status and the Vendor's booking status update accordingly without either side taking manual action.

**TC-VEN-149 | Priority: Medium | Price shown to the User always matches the vendor's configured price**
1. As Vendor 3, set "Galle Sports Zone – Unawatuna Beach Court" to LKR 2600/slot.
2. As Ishara Rajapaksa (User), view that venue and start a booking for 2 slots.
- **Expected:** User App shows total = 2 × 2600 = LKR 5200, matching the vendor-configured price exactly (server-computed, not client-editable).

**TC-VEN-150 | Priority: Medium | Multiple vendors' venues coexist correctly in a single Explore search**
1. As any User, search Explore → Venues with a wide radius covering Colombo, Kandy, and Galle.
- **Expected:** Venues from all 3 vendors appear correctly, each attributed to the right business, with correct independent pricing/availability — no data bleed between vendors.

---

## 17. Appendix — Known Behavioral Notes (read before logging bugs)

| Area | Behavior | Status |
|---|---|---|
| "Forgot password?" (Login) | Shows a placeholder alert only, no real reset flow | Confirmed stub |
| Google / Apple sign-in (Login & Register) | Placeholder alerts only, not wired to real social auth | Confirmed stub |
| Vendor registration | No OTP/email verification or admin approval — account is usable immediately | By design |
| Sport selector on Create Venue | Cosmetic only; not stored/enforced server-side | By design (worth flagging to product if unintended) |
| Vendor "Edit Profile" | Does not exist — vendors can't edit business name/email/phone post-signup | Confirmed gap — Trainers have this, Vendors don't |
| Settings → Notification Preferences / Staff Management / Help & Support | All three are "Coming soon" stubs | Confirmed stub |
| Booking lifecycle | Only `PENDING_VENDOR → ACTIVE_MATCH → CANCELLED` — there is no "Completed" state | By design |
| Vendor booking detail | Only shows the organizer, not a full player roster (unlike Trainer's Session Roster) | By design difference vs Trainer flow |
| `vendor/payments*`, `vendor/subscription*` endpoints | Flagged in source as unverified against the live backend | Treat failures here as expected-but-must-be-precisely-reported |
| Tournament management | Does not exist anywhere in vendor-app | Confirmed absent |
