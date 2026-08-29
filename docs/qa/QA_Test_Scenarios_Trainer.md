# Paasxo — Trainer App QA Test Scenarios

**App under test:** `vendor-app` (Expo/React Native), logged in as an account with `accountType = TRAINER`
**Backend:** `mobile-app-paasxo` (Spring Boot), shared by Vendor App, Trainer role, and the User App
**Companion documents:** `QA_Test_Scenarios_Vendor.md`, `QA_Test_Scenarios_User.md`

---

## 1. Scope

Trainer is **not a separate app** — it is the second account type inside `vendor-app` (same login screen as Vendor, different navigation stack once logged in). This document covers everything available to a **Trainer** account: registration/login, building a trainer profile, creating training **sessions** (each with its own category, schedule, timing, capacity, price), generating bookable dates for each session, viewing who's booked ("roster"), notifications, payments, subscription, and settings. It also includes negative tests and cross-app integration tests where a Trainer's session must be bookable correctly from the User App (Paasxo customer app).

---

## 2. Test Data — Dummy Accounts (use these exact values across all 3 test documents for consistency)

### Trainers (3 trainers, each running 2 sessions in different categories/timings)

| Trainer (login) | Email | Password | Phone | Specialties | Hourly Rate | Session A | Session B |
|---|---|---|---|---|---|---|---|
| Trainer 1 | Kasun Fernando | `kasun.trainer@paasxotest.com` | `Test@1234` | +94 71 444 5555 | Gym, CrossFit | LKR 2000 | **"Morning Strength Bootcamp"** — Gym, Mon/Wed/Fri **06:00 AM**, 60 min, capacity 10, in-person (Colombo) | **"Evening CrossFit Blast"** — CrossFit, Tue/Thu **06:00 PM**, 45 min, capacity 8, in-person |
| Trainer 2 | Dilani Wijesekara | `dilani.trainer@paasxotest.com` | `Test@1234` | +94 71 555 6666 | Yoga, Pilates | LKR 1800 | **"Sunrise Yoga Flow"** — Yoga, **daily (Mon–Sun)** **05:30 AM**, 60 min, capacity 15, **online** | **"Pilates Core Reset"** — Pilates, Mon/Wed/Fri **04:00 PM**, 50 min, capacity 12, in-person (Kandy) |
| Trainer 3 | Roshan Silva | `roshan.trainer@paasxotest.com` | `Test@1234` | +94 71 666 7777 | Martial Arts, Calisthenics | LKR 2200 | **"Muay Thai Fundamentals"** — Martial Arts, Tue/Thu/Sat **07:00 PM**, 75 min, capacity 10, in-person (Galle) | **"Street Workout Calisthenics"** — Calisthenics, Sat/Sun **09:00 AM**, 60 min, capacity 15, in-person |

This mix intentionally covers: 5 distinct categories (Gym, CrossFit, Yoga, Pilates, Martial Arts, Calisthenics — 6 actually), morning vs evening timing, weekday vs weekend vs daily recurrence, online vs in-person, and varying capacities — enough spread to exercise every scheduling/timing rule.

### Supporting accounts (from the other two documents, needed for cross-app tests)
- Normal users: **Ashan Perera, Dilshan Silva, Nadeesha Fernando, Chamara Jayasuriya, Ishara Rajapaksa** (see `QA_Test_Scenarios_User.md`)
- Vendors: **Nimal Perera, Saman Kumara, Ruwani Silva** (see `QA_Test_Scenarios_Vendor.md`)

---

## 3. Legend

- **Priority:** High (core booking/scheduling path) / Medium / Low
- Screen names and button/field labels are quoted exactly as they appear in the UI.
- **[Known behavior]** marks a result that looks unusual but is confirmed intentional or a confirmed stub.
- **[Confirmed gap]** marks a missing feature worth logging if found broken beyond what's described here.
- Key rule to keep in mind throughout this document: **joining a trainer session in the User App requires the customer to have an active Pro/PAASXO Plus subscription** — it is gated purely on subscription status, not a separate payment-per-session charge the way venue bookings are.

---

## 4. Module 1 — Registration & Login

**TC-TRN-001 | Priority: High | Register a new Trainer account**
1. Open the app (logged out) → **Login** → tap **"Sign Up for free"**.
2. On **Register**, under **"I am a"**, select the **Trainer** card ("Run training sessions"). Confirm the screen title switches to **"Become a Trainer"**.
3. Optionally tap the avatar circle → pick a profile photo.
4. Fill: Name = `Kasun Fernando`, Email = `kasun.trainer@paasxotest.com`, Phone = `+94 71 444 5555`, Password = `Test@1234`, Confirm Password = `Test@1234`.
5. Under **"Your training specialties"**, select chips **Gym** and **CrossFit**.
6. Tap **"Create Trainer Account"**.
- **Expected:** Registration succeeds immediately (no OTP/approval step — **[Known behavior]**); app navigates straight to **Trainer Dashboard**, logged in as the new trainer.

**TC-TRN-002 | Priority: High | Register second and third trainer accounts**
- Repeat TC-TRN-001 for Trainer 2 (Dilani Wijesekara, specialties Yoga + Pilates) and Trainer 3 (Roshan Silva, specialties Martial Arts + Calisthenics) using the data table above.
- **Expected:** Each account registers independently with its own empty Trainer Dashboard.

**TC-TRN-003 | Priority: High | Sign in with valid trainer credentials**
1. On Login, enter `kasun.trainer@paasxotest.com` / `Test@1234` → **"Sign In"**.
- **Expected:** Navigates to **Trainer Dashboard** (title "Kasun Fernando" / "Welcome back — here's your coaching overview.").

**TC-TRN-004 | Priority: Medium | Sign in with wrong password / unregistered email**
1. Attempt sign-in with an incorrect password, then with an email that was never registered.
- **Expected:** Both attempts show alert **"Sign in failed"**; no session is created.

**TC-TRN-005 | Priority: Low | Empty-field validation on Login**
1. Leave both fields blank → tap **"Sign In"**.
- **Expected:** Client-side validation blocks submission.

**TC-TRN-006 | Priority: Low | "Forgot password?" is a placeholder**
1. Tap **"Forgot password?"**.
- **Expected: [Known behavior]** — generic placeholder alert only, no real reset flow.

**TC-TRN-007 | Priority: Low | Google / Apple sign-in buttons are stubs**
1. Tap **"Google"**, then **"Apple"** on Login/Register.
- **Expected: [Known behavior]** — placeholder alerts; no session created either way.

**TC-TRN-008 | Priority: Medium | Registration validation — password too short / mismatched confirm**
1. Try a password under 6 characters; separately try Password ≠ Confirm Password.
- **Expected:** Both blocked with validation errors; no account created.

**TC-TRN-009 | Priority: Medium | Registration validation — invalid email**
1. Enter a malformed email → submit.
- **Expected:** Blocking validation error.

**TC-TRN-010 | Priority: Medium | Registration requires at least one specialty**
1. Fill all fields but select zero specialty chips → submit.
- **Expected:** Blocking validation error requiring ≥1 specialty selected (mirrors the backend/profile rule that a trainer profile needs ≥1 category).

**TC-TRN-011 | Priority: Medium | Duplicate email registration**
1. Attempt to register a second Trainer using `kasun.trainer@paasxotest.com` (already used).
- **Expected:** Registration fails with a server-side "email already in use" style error.

**TC-TRN-012 | Priority: Low | Session persistence across app restart**
1. Sign in as Trainer 1 → force-close → reopen the app.
- **Expected:** Brief hydration splash, then lands directly on Trainer Dashboard without re-prompting login.

**TC-TRN-013 | Priority: Medium | Log out clears the session correctly**
1. From Trainer Dashboard → Settings tab → **"Log Out"** → confirm.
2. Force-close and reopen the app.
- **Expected:** Returns to Login; session is genuinely cleared (does not auto-restore).

**TC-TRN-014 | Priority: Medium | A Vendor account cannot see Trainer screens and vice versa**
1. Sign in as Vendor 1 (Nimal Perera) and confirm the Vendor stack (Dashboard/Bookings/Payments/Settings) loads — no Trainer Dashboard/Sessions tabs appear.
2. Sign in as Trainer 1 and confirm the Trainer stack (Dashboard/Sessions/Payments/Settings) loads — no venue/booking-accept screens appear.
- **Expected:** Navigation stack is strictly determined by `accountType`; the two roles never mix UI.

---

## 5. Module 2 — Trainer Dashboard

**TC-TRN-015 | Priority: High | No-profile state before creating a trainer profile**
1. Sign in as a freshly-registered trainer who hasn't set up their profile.
- **Expected:** Dashboard shows the mascot illustration, "Set up your trainer profile" heading, and a **"Create Trainer Profile"** button; no "New Session" button is shown yet (profile must exist first).

**TC-TRN-016 | Priority: High | "Create Trainer Profile" navigates correctly**
1. Tap **"Create Trainer Profile"**.
- **Expected:** Navigates to **Edit Trainer Profile** screen with empty fields.

**TC-TRN-017 | Priority: High | Has-profile Dashboard state after profile setup**
1. After completing a trainer profile (Module 3) and creating at least one session, return to Dashboard.
- **Expected:** Shows stat cards **"Active Sessions"**, **"Total Weekly Capacity"**, **"Specialties"** (count) with correct numbers; **"My Sessions"** section lists up to 4 session cards; **"New Session"** button now appears in the header area.

**TC-TRN-018 | Priority: Medium | "New Session" button navigates correctly**
1. Tap **"New Session"**.
- **Expected:** Navigates to **Create Session** with empty fields.

**TC-TRN-019 | Priority: Medium | "Edit Profile" link on Dashboard**
1. Tap **"Edit Profile"** in the "My Sessions" section header.
- **Expected:** Navigates to **Edit Trainer Profile**, pre-filled with existing data.

**TC-TRN-020 | Priority: Medium | Session card tap navigates to Session Detail**
1. Tap any session card on the Dashboard.
- **Expected:** Navigates to **Session Detail** for that exact session.

**TC-TRN-021 | Priority: Medium | Empty-sessions state (profile exists, no sessions yet)**
1. As a trainer with a completed profile but zero sessions, view Dashboard.
- **Expected:** Shows an empty state with **"+ Create Session"** CTA in place of the session list.

**TC-TRN-022 | Priority: Medium | Notification bell badge and navigation**
1. Trigger a session-related notification (e.g. a user books a slot), check the bell badge, then tap it.
- **Expected:** Badge shows correct unread count (polled ~every 15s); tapping navigates to **Notifications**.

**TC-TRN-023 | Priority: Low | "Total Weekly Capacity" stat accuracy**
1. As Trainer 1 with "Morning Strength Bootcamp" (capacity 10, Mon/Wed/Fri) and "Evening CrossFit Blast" (capacity 8, Tue/Thu), check the stat.
- **Expected:** Reflects a sensible aggregate of weekly capacity across active sessions (verify the exact formula used matches what's displayed — e.g. sum of capacity × sessions/week, or similar — and flag if the number looks nonsensical).

---

## 6. Module 3 — Trainer Profile Setup & Edit

**TC-TRN-024 | Priority: High | Create Kasun Fernando's trainer profile**
1. From the no-profile Dashboard state, tap **"Create Trainer Profile"**.
2. Pick a cover photo and an avatar/profile photo.
3. Under **Specialties**, select **Gym** and **CrossFit**.
4. Bio = `Certified strength & conditioning coach with 8 years of experience helping athletes build power and endurance.`
5. Certifications = `NASM-CPT, ACE Certified`.
6. Experience (yrs) = `8`.
7. Hourly Rate (LKR) = `2000`.
8. Location = `Colombo 07`.
9. Tap **"Save Profile"**.
- **Expected:** Profile saves successfully; Dashboard now shows the has-profile state with correct Specialties count (2).

**TC-TRN-025 | Priority: High | Create Dilani Wijesekara's and Roshan Silva's profiles**
- Repeat TC-TRN-024 for Trainer 2 (specialties Yoga + Pilates, rate 1800, location Kandy) and Trainer 3 (specialties Martial Arts + Calisthenics, rate 2200, location Galle) using Section 2's data.
- **Expected:** Each trainer has an independent, correctly saved profile.

**TC-TRN-026 | Priority: Medium | Validation — no specialty selected**
1. Start Edit Trainer Profile, fill Bio but select zero specialty chips → tap **"Save Profile"**.
- **Expected:** Blocking validation error requiring ≥1 category.

**TC-TRN-027 | Priority: Medium | Validation — empty bio**
1. Select ≥1 specialty, leave Bio blank → save.
- **Expected:** Blocking validation error (bio is required).

**TC-TRN-028 | Priority: Medium | "Other" specialty chip**
1. Select the **Other** specialty chip (alongside or instead of a defined category) → save.
- **Expected:** Saves successfully and displays as a specialty on the profile.

**TC-TRN-029 | Priority: Medium | Update an existing profile's hourly rate**
1. Edit Trainer 1's profile, change Hourly Rate from `2000` to `2200` → **"Save Profile"**.
- **Expected:** Change persists and is reflected on the Trainer Profile view in the User App (verify via cross-app test in Module 12).

**TC-TRN-030 | Priority: Medium | Update cover photo and avatar**
1. Edit any trainer's profile, replace cover photo and avatar → save.
- **Expected:** Both images update and display correctly wherever the trainer's profile is shown (Dashboard, and User App's Trainer Profile screen).

**TC-TRN-031 | Priority: Low | Certifications and Experience fields are optional-friendly**
1. Save a profile leaving Certifications blank and Experience at 0.
- **Expected:** Saves without error; fields display sensibly (e.g. hidden or "—") where blank.

**TC-TRN-032 | Priority: Medium | Change specialties after sessions already exist**
1. As Trainer 1 (with existing Gym/CrossFit sessions), edit the profile to remove "CrossFit" and add "Yoga" instead.
- **Expected:** Profile updates; verify existing "Evening CrossFit Blast" session (still categorized CrossFit) is unaffected/still visible — categories on existing sessions don't retroactively change just because the trainer's profile specialties changed.

**TC-TRN-033 | Priority: Low | Very long bio text**
1. Enter a 1000+ character Bio → save.
- **Expected:** Saves and displays without breaking layout (scrollable/truncated as appropriate).

---

## 7. Module 4 — Create & Edit Sessions (categories, timing, capacity)

**TC-TRN-034 | Priority: High | Create Kasun's "Morning Strength Bootcamp" (Gym, morning, weekday)**
1. From Trainer Dashboard, tap **"New Session"**.
2. Under **Category**, select **Gym**.
3. Add a Session Photo.
4. Session Title = `Morning Strength Bootcamp`.
5. Description = `High-intensity strength training to start your day right.`
6. Price (LKR) = `2000`, Duration (min) = `60`, Capacity = `10`.
7. Under **"Repeats Weekly On"**, select day chips **Mon, Wed, Fri**.
8. Start Time = `06:00 AM`.
9. Leave **Online Session** toggle OFF.
10. Location = `Independence Square, Colombo 07`.
11. "Diet Plan / Workout Schedule / Comments" = `Bring your own mat and water bottle. Warm-up starts 5 min before session time.`
12. Tap **"Create Session"**.
- **Expected:** Session saves; appears on Trainer Dashboard "My Sessions" and on the **Trainer Sessions** tab list with title, category · price/session, days · start time · duration all correct.

**TC-TRN-035 | Priority: High | Create Kasun's "Evening CrossFit Blast" (CrossFit, evening, different weekdays)**
1. Repeat the flow with Category = **CrossFit**, Title = `Evening CrossFit Blast`, Price = `2000`, Duration = `45`, Capacity = `8`, Days = **Tue, Thu**, Start Time = `06:00 PM`, Online OFF, same/different location.
- **Expected:** Second session created independently; Trainer 1 now has 2 sessions with distinct categories and non-overlapping days/times.

**TC-TRN-036 | Priority: High | Create Dilani's "Sunrise Yoga Flow" (Yoga, daily, online)**
1. Category = **Yoga**, Title = `Sunrise Yoga Flow`, Price = `1800`, Duration = `60`, Capacity = `15`, Days = **all 7 days (Mon–Sun)**, Start Time = `05:30 AM`.
2. Turn **Online Session** toggle ON — confirm the **Location** field disappears/hides once toggled on, per the hint "No physical location needed".
3. Save.
- **Expected:** Session saves as online; Location is not required/shown; appears correctly in the trainer's session list.

**TC-TRN-037 | Priority: High | Create Dilani's "Pilates Core Reset" (Pilates, afternoon, in-person)**
1. Category = **Pilates**, Title = `Pilates Core Reset`, Price = `1800`, Duration = `50`, Capacity = `12`, Days = **Mon, Wed, Fri**, Start Time = `04:00 PM`, Online OFF, Location = `Kandy City Centre area`.
- **Expected:** Session saves correctly; Dilani now has 2 sessions — one online (daily/morning), one in-person (weekday/afternoon).

**TC-TRN-038 | Priority: High | Create Roshan's "Muay Thai Fundamentals" (Martial Arts, evening, alt weekdays+Sat)**
1. Category = **Martial Arts**, Title = `Muay Thai Fundamentals`, Price = `2200`, Duration = `75`, Capacity = `10`, Days = **Tue, Thu, Sat**, Start Time = `07:00 PM`, Online OFF, Location = `Galle Fort area`.
- **Expected:** Session saves correctly.

**TC-TRN-039 | Priority: High | Create Roshan's "Street Workout Calisthenics" (Calisthenics, weekend morning)**
1. Category = **Calisthenics**, Title = `Street Workout Calisthenics`, Price = `2200`, Duration = `60`, Capacity = `15`, Days = **Sat, Sun**, Start Time = `09:00 AM`, Online OFF, same/different location.
- **Expected:** Session saves correctly; Roshan now has 2 sessions covering weekday-evening and weekend-morning timing.

**TC-TRN-040 | Priority: Medium | Validation — no category selected**
1. Fill all fields except Category → tap **"Create Session"**.
- **Expected:** Blocking validation error.

**TC-TRN-041 | Priority: Medium | Validation — empty title**
1. Fill all fields except Session Title → submit.
- **Expected:** Blocking validation error.

**TC-TRN-042 | Priority: Medium | Validation — price is negative**
1. Enter a negative Price → submit.
- **Expected:** Blocking validation error ("valid price ≥ 0" per code — confirm 0 itself is accepted as a valid free-session price if that's intended, and only negative values are rejected).

**TC-TRN-043 | Priority: Medium | Validation — duration is zero**
1. Enter Duration = `0` → submit.
- **Expected:** Blocking validation error (duration must be > 0).

**TC-TRN-044 | Priority: Medium | Validation — capacity is zero**
1. Enter Capacity = `0` → submit.
- **Expected:** Blocking validation error (capacity must be > 0).

**TC-TRN-045 | Priority: High | Validation — no day selected**
1. Fill all fields but select zero day chips under "Repeats Weekly On" → submit.
- **Expected:** Blocking validation error requiring ≥1 day.

**TC-TRN-046 | Priority: High | Validation — location required unless Online**
1. Leave **Online Session** OFF and leave Location blank → submit.
- **Expected:** Blocking validation error. Then toggle **Online Session** ON with Location still blank → submit again.
- **Expected:** Now succeeds (location becomes optional once Online is enabled).

**TC-TRN-047 | Priority: Medium | Edit an existing session's price and capacity**
1. From **Trainer Sessions** tab, tap **"Edit"** on "Morning Strength Bootcamp".
2. Change Price to `2100`, Capacity to `12` → **"Save Changes"**.
- **Expected:** Session updates; already-generated future date slots for this session keep their original denormalized capacity/price snapshot (per backend design — `TrainerSessionSlot` denormalizes capacity/time from the session at generation time), while newly generated slots after this edit use the new values. Verify actual observed behavior matches this and document if slots retroactively change (which would be unexpected).

**TC-TRN-048 | Priority: Medium | Edit a session's schedule (days/start time)**
1. Edit "Pilates Core Reset", change Start Time from `04:00 PM` to `05:00 PM`, and days from Mon/Wed/Fri to Mon/Tue/Wed/Thu/Fri.
- **Expected:** Saves successfully; newly generated slots reflect the new schedule.

**TC-TRN-049 | Priority: Medium | Toggle a session from in-person to Online during edit**
1. Edit "Muay Thai Fundamentals", turn **Online Session** ON, clear Location.
- **Expected:** Saves; session now displays as online in both Trainer Sessions list and the User App's Trainer Session Details screen.

**TC-TRN-050 | Priority: Low | Session photo can be changed on edit**
1. Edit any session, replace the Session Photo → save.
- **Expected:** New image displays correctly across Session Detail, Trainer Sessions list, and the User App.

**TC-TRN-051 | Priority: Medium | Create a session with all 7 days selected**
1. Create/edit a session selecting every day chip Mon–Sun.
- **Expected:** Saves correctly; "Repeats {days}" text on Session Detail reads all 7 days sensibly (e.g. "Repeats Daily" or lists all days without overflow issues).

**TC-TRN-052 | Priority: Low | "Diet Plan / Workout Schedule / Comments" is optional and multiline**
1. Save a session leaving this field blank; separately save another with a multi-paragraph plan.
- **Expected:** Both save correctly; the populated one displays fully (with line breaks preserved) on Session Detail's "Diet / Workout Plan" box; the blank one simply omits that box.

**TC-TRN-053 | Priority: Medium | Category selection determines what shows in User App category filters**
1. Create a session with Category = **Martial Arts**.
2. In the User App, filter trainers/sessions by category "Martial Arts".
- **Expected:** The session/trainer appears correctly under that filter (full cross-app check happens in Module 12; this step confirms the category value round-trips correctly).

**TC-TRN-054 | Priority: Low | Create a fourth session under one trainer**
1. As Trainer 1 (already has 2 sessions), create a third session in a different category (e.g. Dancing).
- **Expected:** Confirms there's no hard 2-session cap; Trainer Sessions list now shows 3 sessions with correct filtering/sorting.

**TC-TRN-055 | Priority: Medium | Cancel out of Create Session without saving**
1. Start filling Create Session, then navigate back before tapping Create.
- **Expected:** No session is created; session list is unchanged.

---

## 8. Module 5 — Trainer Sessions List & Session Detail

**TC-TRN-056 | Priority: High | Trainer Sessions tab lists all sessions with correct summary**
1. As Trainer 1 (2 sessions), open the **Sessions** tab.
- **Expected:** Header subtitle reads "2 sessions · manage schedule & bookings"; each card shows title, category · price/session, days · start time · duration, and pill buttons **"Availability"** and **"Edit"**.

**TC-TRN-057 | Priority: Medium | "Availability" pill navigates correctly**
1. Tap **"Availability"** on "Evening CrossFit Blast".
- **Expected:** Opens **Manage Session Availability** scoped to that exact session.

**TC-TRN-058 | Priority: Medium | "Edit" pill navigates correctly**
1. Tap **"Edit"** on "Sunrise Yoga Flow".
- **Expected:** Opens **Create Session** (edit mode) pre-filled with that session's data.

**TC-TRN-059 | Priority: Medium | FAB (+) on Sessions tab**
1. Tap the floating **"+"** button (bottom-right).
- **Expected:** Navigates to **Create Session** with empty fields.

**TC-TRN-060 | Priority: Low | Empty state on Sessions tab**
1. View the Sessions tab for a trainer with a profile but zero sessions.
- **Expected:** Shows empty state with **"+ Create Session"** CTA.

**TC-TRN-061 | Priority: Low | Inactive session shows "Inactive" pill**
1. If there's a way to deactivate a session (check for a toggle in Edit Session; if none exists, note as a gap), deactivate one and view the Sessions list.
- **Expected:** Card shows an **"Inactive"** pill; confirm whether inactive sessions are still bookable in the User App (should NOT be).

**TC-TRN-062 | Priority: High | Session Detail shows correct facts**
1. Tap into "Morning Strength Bootcamp" → **Session Detail**.
- **Expected:** Hero image, **"Details"** card with description, fact chips (start time + duration = "06:00 AM · 60 min", capacity = "10 spots", location "Independence Square, Colombo 07"), "Repeats Mon, Wed, Fri" text, and the "Diet / Workout Plan" box if one was set.

**TC-TRN-063 | Priority: Medium | Session Detail — Online session shows no location, shows online indicator**
1. View Session Detail for "Sunrise Yoga Flow".
- **Expected:** Displays "Online" instead of a physical address/map.

**TC-TRN-064 | Priority: High | "Upcoming Dates" card reflects generated availability**
1. After generating slots (Module 6) for "Morning Strength Bootcamp", view Session Detail.
- **Expected:** Lists up to 8 upcoming non-cancelled dates, each showing date badge, time range, and "{spotsLeft} of {capacity} spots left" (or "Full").

**TC-TRN-065 | Priority: Medium | Tapping an upcoming date opens Session Roster**
1. On Session Detail, tap a date row under "Upcoming Dates".
- **Expected:** Navigates to **Session Roster** for that exact session + date/slot.

**TC-TRN-066 | Priority: Medium | "Manage" link and "Manage Availability" button both work**
1. Tap the **"Manage"** link next to "Upcoming Dates", then separately tap the **"Manage Availability"** button lower on the screen.
- **Expected:** Both navigate to **Manage Session Availability** for this session.

**TC-TRN-067 | Priority: Medium | Edit (pencil) FAB on Session Detail hero**
1. Tap the pencil FAB.
- **Expected:** Navigates to **Create Session** (edit mode) for this session.

---

## 9. Module 6 — Manage Session Availability (generating bookable dates/timing)

**TC-TRN-068 | Priority: High | Generate availability for the next 7 days**
1. Open **Manage Session Availability** for "Morning Strength Bootcamp" (Mon/Wed/Fri, 06:00 AM).
2. Tap the **"Next 7 days"** quick-select.
3. Tap **"Generate Availability"**.
- **Expected:** Creates a bookable date for every Mon/Wed/Fri occurring within the next 7 days (i.e. up to 3 dates), each with `startTime=06:00`, `capacity=10` (denormalized snapshot), status OPEN. Non-matching weekdays are NOT created as bookable dates.

**TC-TRN-069 | Priority: High | Generate availability for the next 30 days**
1. On "Evening CrossFit Blast" (Tue/Thu), tap **"Next 30 days"** → **"Generate Availability"**.
- **Expected:** Creates every Tue/Thu occurrence in the next 30 days (~8-9 dates); "Upcoming Dates" list updates accordingly.

**TC-TRN-070 | Priority: Medium | Generate availability with a custom From/To range**
1. Manually set From = tomorrow, To = 14 days out, for "Sunrise Yoga Flow" (daily) → **"Generate Availability"**.
- **Expected:** Creates one date per day across that 14-day window (all 7 weekdays match, since the session repeats daily).

**TC-TRN-071 | Priority: High | Re-generating an overlapping range doesn't duplicate dates**
1. Generate "Next 7 days" for a session, then immediately generate "Next 7 days" again.
- **Expected:** No duplicate date entries appear (unique per `(session, date)` per backend rule); "Upcoming Dates" count is unchanged after the second generation.

**TC-TRN-072 | Priority: Medium | Generated dates match the session's exact configured start time and duration**
1. Generate dates for "Pilates Core Reset" (start 04:00 PM, 50 min).
2. Check each generated date's time range in "Upcoming Dates".
- **Expected:** Every date shows `04:00 PM – 04:50 PM` exactly.

**TC-TRN-073 | Priority: High | Cancel a single upcoming date**
1. In "Upcoming Dates", tap the cancel (X) icon on one specific date.
2. Confirm the dialog: **"Cancel this date?"** with body text about users keeping their spot recorded but no one new being able to join → tap **"Cancel Date"**.
- **Expected:** That date is removed from the bookable list (or shown as cancelled); status flips to CANCELLED; it no longer appears as bookable in the User App for that specific date, while OTHER upcoming dates for the same session remain unaffected.

**TC-TRN-074 | Priority: Medium | "Keep" dismisses the cancel-date confirmation**
1. Tap the cancel (X) icon, then tap **"Keep"** in the dialog.
- **Expected:** Date remains active/unchanged.

**TC-TRN-075 | Priority: Medium | Cancelling a date that already has bookings preserves those bookings' records**
1. Have a user (see Module 12) book a specific date/slot on "Muay Thai Fundamentals".
2. As Trainer 3, cancel that exact date.
- **Expected:** Per the confirmation dialog's own wording, the user who already joined "keeps their spot recorded" (i.e. their `TrainerBooking` record isn't silently deleted), but the date shows CANCELLED and no further joins are possible. Verify in the User App what the affected user actually sees (ideally a cancellation notice — confirm whether one exists; if not, log as a gap).

**TC-TRN-076 | Priority: Medium | Generated slot capacity is a snapshot, not a live pointer**
1. Generate dates for "Morning Strength Bootcamp" while capacity = 10.
2. Edit the session, change capacity to 6.
3. Check an already-generated future date.
- **Expected:** Per backend design, the already-generated date keeps its original denormalized capacity of 10 (doesn't retroactively shrink) — confirm actual UI behavior matches this and flag any mismatch.

**TC-TRN-077 | Priority: Low | Generate availability with From date after To date**
1. Manually set From = 10 days out, To = 5 days out → attempt **"Generate Availability"**.
- **Expected:** Blocked with a validation error, or silently generates nothing — document actual behavior since this is an edge case worth confirming isn't silently broken.

**TC-TRN-078 | Priority: Low | Generate availability with a past From date**
1. Attempt to set From to a date before today.
- **Expected:** Date picker should prevent past-date selection, or generation for past dates should have no visible effect on bookability.

**TC-TRN-079 | Priority: Medium | Independent availability across two sessions of the same trainer**
1. Generate dates for "Morning Strength Bootcamp" only (not "Evening CrossFit Blast").
2. Check both sessions' "Upcoming Dates".
- **Expected:** Only the session that was explicitly generated shows dates; the other remains empty until separately generated — confirms per-session independence.

**TC-TRN-080 | Priority: Medium | Availability generation is scoped strictly to the owning trainer**
1. As Trainer 2, attempt to view/manage availability for one of Trainer 1's sessions (if reachable via any means, e.g. crafted deep link).
- **Expected:** Access denied / not found — a trainer cannot manage another trainer's sessions.

---

## 10. Module 7 — Session Roster

> Precondition: at least one normal User has an active Pro/PAASXO Plus subscription and has joined a specific session date (see `QA_Test_Scenarios_User.md`, Trainer Booking Flow).

**TC-TRN-081 | Priority: High | Roster shows joined members for a specific date**
1. From Session Detail's "Upcoming Dates" (or Sessions tab → Availability → tap a date), open **Session Roster** for a date where Ashan Perera has joined "Morning Strength Bootcamp".
- **Expected:** Header "Session Roster" / "Members joined for {date}"; Ashan's avatar, display name, "Joined {date}", and price paid (LKR) all appear correctly.

**TC-TRN-082 | Priority: Medium | Roster empty state**
1. Open Session Roster for a generated date nobody has booked yet.
- **Expected:** Shows **"No one's joined yet"**.

**TC-TRN-083 | Priority: High | Roster updates as more members join**
1. Have Dilshan Silva and Nadeesha Fernando also join the same date/slot as Ashan (up to capacity).
2. Refresh/reopen the Roster.
- **Expected:** All 3 members appear with correct join timestamps and prices paid.

**TC-TRN-084 | Priority: Medium | Roster is scoped to the exact date/slot, not the whole session**
1. Generate 2 different dates for the same session; have users join only one of them.
2. Check Roster for both dates separately.
- **Expected:** Only the date that was actually booked shows members; the other date's roster is empty.

**TC-TRN-085 | Priority: Medium | Roster reflects a cancelled booking correctly**
1. Have a user join a date, then cancel their own trainer booking from the User App (if that screen exists — see gap note in the User document).
2. Recheck the Roster.
- **Expected:** The member no longer appears (or appears with a cancelled marker) and the date's spots-left count increases back.

**TC-TRN-086 | Priority: Low | Roster price-paid matches the session price at time of booking**
1. Compare a roster entry's "price paid" against the session's price when the user joined.
- **Expected:** Matches exactly (snapshotted at booking time, per backend design, so a later price edit on the session doesn't retroactively change historical roster entries).

**TC-TRN-087 | Priority: Medium | A trainer cannot view another trainer's roster**
1. As Trainer 2, attempt to access Trainer 1's Session Roster for any session/date (via any reachable path).
- **Expected:** Access denied / not found (`requireOwnedSession` server-side check).

---

## 11. Module 8 — Notifications

**TC-TRN-088 | Priority: High | Notifications list shows correct unread count**
1. Generate a few notifications (e.g. users joining sessions) → open **Notifications**.
- **Expected:** Subtitle shows correct unread count; unread items have a dot indicator.

**TC-TRN-089 | Priority: Medium | Tapping a notification marks it read**
1. Tap any unread notification.
- **Expected:** Unread dot disappears; badge count decreases.

**TC-TRN-090 | Priority: Medium | "Mark all read"**
1. With several unread notifications, tap **"Mark all read"**.
- **Expected:** All items lose their unread dot; subtitle changes to "You're all caught up".

**TC-TRN-091 | Priority: Low | Empty notifications state**
1. View Notifications for a brand-new trainer account.
- **Expected:** Shows **"No notifications yet"**.

**TC-TRN-092 | Priority: Medium | Notifications refresh automatically (~15s polling)**
1. Leave Notifications open; from a User account, join one of this trainer's sessions.
- **Expected:** New notification and updated unread count appear without manual refresh within ~15 seconds.

**TC-TRN-093 | Priority: Low | Only booking-approval notifications have special tap-routing**
1. Compare tap behavior across different notification types received.
- **Expected: [Known behavior]** — per the codebase, only `BOOKING_PENDING_VENDOR_APPROVAL`-type notifications have dedicated navigation logic; trainer-relevant notification types may simply mark-as-read without deep-linking anywhere specific. Confirm this doesn't feel broken to a real trainer user, and note if a more specific destination (e.g. straight to the Roster) would be expected but is currently missing.

**TC-TRN-094 | Priority: Low | Notifications are scoped per trainer account**
1. Compare Notifications between Trainer 1 and Trainer 2 after activity on both.
- **Expected:** Each trainer only sees their own session-related notifications.

---

## 12. Module 9 — Payment History & Subscription

**TC-TRN-095 | Priority: Medium | Payment History shows Total Revenue for a trainer**
1. Open **Payments** tab as a trainer with completed session bookings.
- **Expected:** "Total Revenue" stat card shows an LKR amount; note (same as the Vendor document) this endpoint is flagged as potentially unverified against the live backend — report exact behavior if it fails.

**TC-TRN-096 | Priority: Low | Filter chips work the same as the Vendor role**
1. Tap **"All Transactions"**, **"Paid"**, **"Pending"**, **"Failed"**.
- **Expected:** Filters the transaction list correctly; this is the same shared screen as Vendor's Payment History.

**TC-TRN-097 | Priority: Medium | Trainer session "payment" reconciliation caveat**
1. Compare a trainer session booking's price/payment record here against what the backend actually charges for trainer bookings.
- **Expected: [Confirmed gap]** — per backend research, trainer-session joins are gated only by an active subscription check; `pricePaid` is stored as a snapshot but there's no confirmed PayHere transaction wiring for `TRAINER_BOOKING` order type yet. If Payment History shows trainer-session transactions as real "Paid" gateway charges, flag this to the team as worth double-checking against actual payment records — it may be a display-only price snapshot rather than money that was actually captured.

**TC-TRN-098 | Priority: Medium | Navigate to Subscription from Settings**
1. Settings → **"Subscription & Billing"**.
- **Expected:** Opens the same **Subscription** screen used by Vendors (Pro Plan, LKR 29.00/month).

**TC-TRN-099 | Priority: Low | Subscription screen discoverability for Trainer role**
1. From every Trainer tab/screen, check whether there's more than one path to reach Subscription.
- **Expected:** Confirm it's reachable at least via Settings; document if Trainer flows feel like they're missing a more prominent upsell (the Vendor Dashboard has no direct in-flow subscription prompt either, so this may be consistent by design — just confirm no dead end/crash).

**TC-TRN-100 | Priority: Low | Complete a subscription payment as a Trainer**
1. Attempt a full Subscription checkout (Card details, "Complete Payment").
- **Expected: [Confirmed gap]** — same caveat as the Vendor document: this endpoint is unverified against the live backend. Document exact behavior/errors observed.

---

## 13. Module 10 — Settings

**TC-TRN-101 | Priority: Medium | Profile card shows correct trainer info**
1. Open Settings as Trainer 2.
- **Expected:** Avatar, display name "Dilani Wijesekara", email, phone all correct.

**TC-TRN-102 | Priority: Medium | Trainers CAN edit their profile (contrast with Vendor gap)**
1. From anywhere reachable, confirm there IS a path to **Edit Trainer Profile** post-registration (Dashboard's "Edit Profile" link, per Module 2).
- **Expected:** Unlike Vendors (who have no post-registration profile edit), Trainers can fully edit bio/specialties/rate/location/photos at any time via the Dashboard link — confirm this remains true and works correctly.

**TC-TRN-103 | Priority: Low | "Notification Preferences" row is a stub**
1. Tap **"Notification Preferences"**.
- **Expected: [Known behavior]** — "Coming soon" alert only.

**TC-TRN-104 | Priority: Low | "Staff Management" row is a stub**
1. Tap **"Staff Management"**.
- **Expected: [Known behavior]** — "Coming soon" alert; doesn't make much conceptual sense for a solo Trainer account, but confirm it's shown consistently (shared component with Vendor) rather than hidden/adapted per role.

**TC-TRN-105 | Priority: Low | "Help & Support" row is a stub**
1. Tap **"Help & Support"**.
- **Expected: [Known behavior]** — shows `support@paasxo.com` alert only.

**TC-TRN-106 | Priority: High | "Log Out" confirmation and actual session clearing**
1. Tap **"Log Out"** → confirm dialog **Cancel**/**Log Out**.
2. Tap **"Log Out"** (destructive) → force-close and reopen the app.
- **Expected:** Returns to Login; session genuinely cleared, does not auto-restore.

---

## 14. Module 11 — Negative Tests & Access Control

**TC-TRN-107 | Priority: High | Trainer cannot see another trainer's sessions/profile-editing controls**
1. As Trainer 3, inspect Dashboard, Sessions, Payments, Notifications.
- **Expected:** Zero visibility into Trainer 1's or Trainer 2's sessions, roster, or notifications.

**TC-TRN-108 | Priority: High | A Vendor account cannot create/manage trainer sessions**
1. If reachable/testable, confirm a VENDOR-type account cannot call the trainer-session-create action.
- **Expected:** Backend rejects with an error (role check is manually enforced per-service, same caveat as the Vendor document — worth spot-checking).

**TC-TRN-109 | Priority: Medium | Expired/invalid auth token is handled gracefully**
1. Force an expired session and perform an action (e.g. generate availability).
- **Expected:** Silent token refresh attempted; on failure, redirected to Login rather than crashing.

**TC-TRN-110 | Priority: Medium | Poor/lost network while generating availability**
1. Enable airplane mode mid-way through tapping "Generate Availability".
- **Expected:** Clear error/retry message; no false-positive success, no duplicate dates created once back online.

**TC-TRN-111 | Priority: Medium | Concurrent capacity race — two users join the last open spot simultaneously**
1. Set a session date's capacity to 1 spot remaining.
2. Coordinate two User test accounts to both tap "Join"/"Pay & Join" at nearly the same time.
- **Expected:** Only one join succeeds; the other receives a "This session date is full" (or equivalent) error — the roster never exceeds the configured capacity.

**TC-TRN-112 | Priority: Low | Very long session title/description**
1. Enter a 500+ character Session Title/Description.
- **Expected:** Either constrained by max length or gracefully truncated in display — no crash/layout break.

**TC-TRN-113 | Priority: Low | Special characters/emoji in session title**
1. Create a session titled `Muay Thai 🥊 Fundamentals!`.
- **Expected:** Saves and displays correctly everywhere (Sessions list, Session Detail, User App).

**TC-TRN-114 | Priority: Medium | App behavior when backend is unreachable**
1. Simulate no connectivity while loading Trainer Dashboard.
- **Expected:** Clear loading/error state, no infinite spinner or crash; recovers once connectivity returns.

---

## 15. Module 12 — Cross-App Integration (Trainer role ↔ User App)

> These tests require running both `vendor-app` (Trainer login) and the customer app (`Paasxo-main`) side by side. Use the User App test data from `QA_Test_Scenarios_User.md`.

**TC-TRN-115 | Priority: High | New trainer profile appears in User App's Trainer search**
1. As Trainer 1, complete the profile and create both sessions with availability generated.
2. In the User App, sign in as Ashan Perera → Home "Trainer" tab (or Explore → Trainers category).
- **Expected:** "Kasun Fernando" appears with correct category chips (Gym, CrossFit), hourly rate, and both sessions listed under his Trainer Profile screen.

**TC-TRN-116 | Priority: High | Session Detail in User App matches Trainer-configured data exactly**
1. As Ashan, open "Morning Strength Bootcamp" from Kasun's Trainer Profile.
- **Expected:** Title, category pill, description, fact chips (time+duration, capacity/spots, location), and "Pick a Date" list of generated dates all match exactly what Trainer 1 configured.

**TC-TRN-117 | Priority: High | Non-subscribed user is blocked from joining, with an Upgrade prompt**
1. As a User account WITHOUT an active Pro/PAASXO Plus subscription, open a session date and tap **Continue**/**Unlock & Join**.
- **Expected:** Alert "PAASXO Plus Required… Upgrade" appears with an **Upgrade** action → routes to `/subscription`; no booking/join is created.

**TC-TRN-118 | Priority: High | Subscribed user successfully joins a session date**
1. As Ashan (now with an active subscription — see User document, Subscription module), open "Sunrise Yoga Flow", pick a date, proceed to **Trainer Checkout**, check the required guidelines checkbox, tap **"Pay & Join"**.
- **Expected:** Routes to **Trainer Booking Confirmed** ("You're In!"); as Trainer 2 (Dilani), check that session date's Session Roster — Ashan now appears with the correct joined timestamp and price paid.

**TC-TRN-119 | Priority: High | Session date fills up and becomes unjoinable at capacity**
1. Have exactly `capacity` distinct subscribed users join the same date on "Evening CrossFit Blast" (capacity 8) — reuse the 5 test users plus additional accounts if needed, or lower the test session's capacity to 2 for a faster repro.
2. Attempt one more join from an additional subscribed user.
- **Expected:** Once full, the date shows "Full" in the User App's date picker (disabled) and, per backend rule, further join attempts are rejected with "This session date is full." Trainer's Session Detail "Upcoming Dates" also shows "Full" for that date.

**TC-TRN-120 | Priority: Medium | Cancelling a date in the Trainer app removes it from the User App's picker**
1. As Trainer 3, cancel a specific upcoming date for "Muay Thai Fundamentals" (Module 6).
2. As a User, reopen that session's "Pick a Date" list.
- **Expected:** The cancelled date no longer appears as selectable.

**TC-TRN-121 | Priority: Medium | Online vs in-person sessions display correctly to users**
1. As a User, compare "Sunrise Yoga Flow" (online) vs "Pilates Core Reset" (in-person) in the User App's Trainer Session Details screen.
- **Expected:** The online session shows an online notice with no map/directions; the in-person one shows a map and a working "Directions" link.

**TC-TRN-122 | Priority: Medium | Editing a trainer's hourly rate/session price reflects in the User App**
1. As Trainer 1, edit "Morning Strength Bootcamp" price from LKR 2000 to LKR 2100.
2. As a User, view the session (a date NOT yet generated before the edit).
- **Expected:** New price displays correctly in Session Details and Trainer Checkout for newly generated dates.

**TC-TRN-123 | Priority: Medium | "My Trainer Bookings" gap — confirm current behavior end-to-end**
1. As Ashan, after joining a session (TC-TRN-118), look through the User App for any "My Trainer Bookings" or similar list, and any way to cancel that booking from the customer side.
- **Expected: [Confirmed gap]** — per the User App research, no such screen exists in the current build even though the backend API (`GET /trainers/bookings/my`, `PATCH /trainers/bookings/{id}/cancel`) supports it. Confirm this is still the case; if found, log it as a product gap (the only way to remove a user from a roster today may be the Trainer cancelling the whole date, per TC-TRN-075).

**TC-TRN-124 | Priority: Medium | Multiple trainers with overlapping categories are distinguishable in search**
1. As a User, filter trainers by category — first "Martial Arts" (should surface Roshan), then note the Trainer tab/Explore also has "Calisthenics" as Roshan's second specialty.
- **Expected:** Roshan Silva appears correctly under both relevant category filters; no confusion with other trainers who don't share those categories.

**TC-TRN-125 | Priority: Low | Trainer earnings (Payment History) reflect real User App joins**
1. After several Users join Trainer 2's paid sessions, check Trainer 2's Payment History → Total Revenue.
- **Expected:** Revenue figure is consistent with the number and price of actual joins (subject to the caveat in TC-TRN-097 about whether this is a real charge or a price snapshot).

---

## 16. Appendix — Known Behavioral Notes (read before logging bugs)

| Area | Behavior | Status |
|---|---|---|
| "Forgot password?" (Login) | Placeholder alert only | Confirmed stub |
| Google / Apple sign-in | Placeholder alerts only | Confirmed stub |
| Trainer registration | No OTP/email verification or admin approval — usable immediately | By design |
| Trainer session join (User App) | Gated only by active subscription, not a per-session gateway charge — `pricePaid` may just be a snapshot | Confirmed gap — verify with team whether this is intended |
| Settings → Notification Preferences / Staff Management / Help & Support | All three are "Coming soon" stubs, shared with Vendor role | Confirmed stub |
| `vendor/payments*`, `vendor/subscription*` endpoints (shared component) | Flagged in source as unverified against the live backend | Treat failures as expected-but-must-be-precisely-reported |
| "My Trainer Bookings" in User App | Backend API exists but no UI screen calls it — users can't self-view/cancel trainer bookings | Confirmed gap |
| Trainer profile editing | Fully available post-registration via Dashboard → "Edit Profile" (unlike Vendor role) | By design |
| Cancelling a session date | Cancels the whole date for everyone; there is no per-user removal from a roster | By design |
| Session slot capacity/time on already-generated dates | Denormalized snapshot at generation time — editing the session afterward does not retroactively change already-generated dates | By design |
