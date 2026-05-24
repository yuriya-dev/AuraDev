# DevAura — Project Brief
> The Life OS for Programmers: Beyond Burnout, Beyond Code

---

## 1. Overview

| Field | Detail |
|---|---|
| **Project Name** | DevAura |
| **Tagline** | Your AI companion that keeps you coding, praying, eating, and breathing — in balance. |
| **Category** | Developer Wellness & Productivity |
| **Platform** | VSCode Extension + Chrome Extension + Cloud Backend |
| **Target Event** | Google Cloud Hackathon |
| **Primary Stack** | Vertex AI (Gemini 2.5 Flash), Cloud Run, Firestore, Firebase Cloud Messaging, Google Calendar API |
| **Status** | Pre-development / Hackathon prototype |

---

## 2. Problem Statement

### 2.1 The Core Problem

Software engineers — especially in Indonesia and Southeast Asia — face a compounded set of daily struggles that existing tools ignore entirely:

- **Burnout** is rampant: 83% of developers report experiencing burnout (Stack Overflow, 2023)
- **Skipped prayers**: Muslim developers often lose track of solat schedules during deep work sessions
- **Irregular meals**: 60%+ of remote developers skip lunch while in flow state
- **Disconnected planning**: Project milestones live in markdown files, never make it to calendars
- **Context collapse**: No tool understands *when* to remind vs. *when* to stay silent

### 2.2 Why Now

- Indonesia has 500,000+ active developers and is the 4th largest Muslim-majority country
- Remote work has removed natural environmental cues (office lunch breaks, colleagues leaving for prayers)
- AI is now capable enough to understand *context* — not just send dumb push notifications
- Google Calendar, Slack, and VSCode are already deeply embedded in developer workflows

### 2.3 Target Audience

**Primary:** Muslim developers in Indonesia & Southeast Asia, working remotely or hybrid, aged 20–35

**Secondary:** Any developer globally who struggles with work-life boundaries and self-care during long coding sessions

---

## 3. Solution

DevAura is an intelligent life OS that lives where developers already work — inside VSCode and the browser — and uses AI to deliver the *right* nudge at the *right moment* without ever breaking flow.

### 3.1 The Six Pillars

#### 🕌 Pillar 1 — Solat & Ibadah Guardian
- Integrates with [Aladhan API](https://aladhan.com/prayer-times-api) for real-time prayer times based on GPS coordinates
- Detects if user is actively coding during prayer window (via git activity + keystroke presence)
- Sends a gentle, AI-generated reminder with sarkas-tapi-peduli tone via Gemini
- Silent mode during video calls (detects active microphone usage)
- Streak tracking: rewards consistent on-time prayers with a wellness score boost

#### 🍽️ Pillar 2 — Makan & Nutrisi Monitor
- Tracks time since last meal (inferred from user session data and self-reported check-ins)
- Suggests nearby food options via Google Maps API based on current time and location
- Aware of fasting schedule (Ramadan mode, optional Monday/Thursday fasting toggle)
- Skips reminders if user is in a meeting or presenting

#### 📅 Pillar 3 — Milestone → Calendar Engine
- Watches for `project_brief.md`, `ROADMAP.md`, `CHANGELOG.md` in open workspace
- Parses milestone sections using Gemini to extract: task name, deadline, priority, and dependencies
- Auto-creates Google Calendar events with smart buffer time (adds 20% buffer before each deadline)
- Generates sub-tasks in Google Tasks and blocks focus time in the user's calendar
- Notifies user of schedule conflicts and suggests rescheduling

#### 🧠 Pillar 4 — Deep Focus Guard
- Monitors git commit frequency, file save rate, and keystroke velocity as proxy for flow state
- Classifies current state as: `idle` / `warming-up` / `deep-focus` / `frustrated` / `done`
- Holds all non-urgent reminders during `deep-focus` state
- Releases queued reminders gently when state transitions to `idle`

#### 💓 Pillar 5 — Burnout Prediction Engine
- Aggregates daily metrics: hours coded, commit frequency, error rate, break frequency
- Sends weekly wellness report to user's Slack DM or WhatsApp (via Twilio)
- Predicts burnout risk 3 days ahead using Gemini with longitudinal session data
- Suggests micro-recovery actions: 5-minute stretches, hydration, short walk

#### 🏆 Pillar 6 — Wellness Streak & Gamification
- Tracks daily streaks: solat on time, meals taken, sleep before midnight, breaks taken
- Weekly wellness score (0–100) with breakdown by category
- Shareable streak cards for Slack/LinkedIn ("I coded 8 hours AND prayed on time today 🔥")
- Team mode: group wellness leaderboard for engineering teams

---

## 4. Unique Features (Wow Factor)

### 4.1 Mood-Aware Message Tone
Gemini analyzes the sentiment of the last 5 commit messages before generating any reminder.

| Commit Sentiment | Generated Tone |
|---|---|
| Frustrated (`"fix this stupid bug again"`) | Empathetic, gentle, supportive |
| Neutral | Friendly, conversational |
| Excited (`"finally got it working!!!"`) | Playful, celebratory, high-energy |
| Late night (`committed at 2am`) | Sarcastic but caring ("bro go to sleep") |

### 4.2 Context-Aware Azan Mute
- Detects active screen share or video call via system audio/mic activity
- Suppresses audio notification, shows silent visual badge in VSCode status bar
- Queues reminder and shows it immediately after call ends

### 4.3 Project Brief → Full Sprint Plan
Beyond just reading milestones, Gemini can:
- Generate a full Agile sprint plan from a `project_brief.md`
- Estimate story points per task
- Create Google Calendar time blocks for each sprint
- Identify risk areas and flag them proactively

### 4.4 Team Sync Mode (Slack Integration)
- DevAura knows team members' online hours from Slack presence API
- Sends coordinated lunch break suggestions to a team channel
- Enables "prayer sync" — notifies teammates before someone goes for solat
- Reduces the loneliness of remote work through shared rituals

---

## 5. Technical Architecture

### 5.1 System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     USER ENVIRONMENT                         │
│   VSCode Extension          Chrome Extension                 │
│   - File watcher            - Tab activity                   │
│   - Git hooks               - Meeting detection              │
│   - Keystroke metrics       - Location (GPS)                 │
└──────────────┬──────────────────────────┬───────────────────┘
               │ HTTPS (events)           │ HTTPS (events)
               ▼                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    CLOUD RUN (Python Flask)                   │
│   /event        — receive activity events                    │
│   /check        — evaluate reminder rules                    │
│   /parse-brief  — parse project_brief.md                     │
│   /generate-msg — call Gemini for message                    │
└──────┬──────────────────────────────────────────────────────┘
       │
       ├──► Firestore (user state, sessions, streaks)
       ├──► Vertex AI / Gemini 2.5 Flash (message gen, parsing)
       ├──► Google Calendar API (event creation)
       ├──► Aladhan API (prayer times)
       ├──► Firebase Cloud Messaging (push notifications)
       └──► Slack Webhook / Twilio (team + SMS notifications)
```

### 5.2 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | VSCode Extension (TypeScript) | Primary activity tracking |
| Frontend | Chrome Extension (JS) | Browser-based tracking |
| Backend | Cloud Run (Python Flask) | Core logic & API gateway |
| AI | Vertex AI — Gemini 2.5 Flash | Message generation, brief parsing |
| Database | Firestore | User state, sessions, streaks |
| Notifications | Firebase Cloud Messaging | Push to desktop/mobile |
| Notifications | Slack Webhook | Team channel messages |
| Scheduling | Cloud Scheduler | 30-minute periodic checks |
| Calendar | Google Calendar API | Milestone event creation |
| Tasks | Google Tasks API | Sub-task management |
| Prayer Times | Aladhan API (free) | Location-based prayer schedule |
| Maps | Google Maps API | Nearby food suggestions |

### 5.3 Data Model (Firestore)

```
users/
  {userId}/
    profile:
      name, timezone, location_lat, location_lng
      fasting_mode: bool
      solat_tracking: bool
      slack_webhook: string
    
    sessions/
      {sessionId}/
        start_time, end_time
        commits_count, files_changed
        state: idle | focus | deep-focus | frustrated
        last_meal_time
        last_break_time
    
    streaks/
      date: string (YYYY-MM-DD)
      solat_fajr: bool
      solat_dhuhr: bool
      solat_asr: bool
      solat_maghrib: bool
      solat_isya: bool
      meals_taken: int (0-3)
      slept_before_midnight: bool
      wellness_score: int (0-100)
    
    projects/
      {projectId}/
        brief_path: string
        milestones: []
        last_parsed: timestamp
        calendar_events: []
```

---

## 6. User Flow

### 6.1 Onboarding (< 5 minutes)
1. Install VSCode Extension
2. Auth with Google account (Calendar + Tasks permissions)
3. Set location (for prayer times) or auto-detect
4. Toggle features: solat, meals, milestone parsing
5. Optionally connect Slack workspace

### 6.2 Daily Flow

```
09:00  → User opens VSCode, extension sends "session start" event
         DevAura begins tracking focus state

10:15  → Gemini detects deep focus state from high commit frequency
         All reminders queued silently

11:45  → State transitions to "idle" (no activity for 5 min)
         DevAura: "Udah 2.5 jam nih, minum air dulu bro 💧"

12:00  → Dhuhr prayer time detected
         User still idle → notification sent:
         "Waktu Dhuhr masuk 10 menit lagi. Kode-nya ke-save kan? 😄"

13:10  → User returns, resumes coding
         DevAura logs prayer taken (confirmed via check-in button)

18:30  → Maghrib reminder, last commit was "FINALLY FIXED THIS"
         Gemini generates: "Bro kamu habis defeat the final boss 🎮
          Sekarang giliran Maghrib dulu. Mantap!"

23:45  → Still active, 8+ hours coded, Isya not yet confirmed
         DevAura: "Bro udah hampir tengah malam. Solat Isya dulu,
          terus tidur. Bug itu bakal masih ada besok, seriously."
```

### 6.3 Milestone Parsing Flow

```
User opens project_brief.md in VSCode
  ↓
Extension detects file open event → sends to Cloud Run /parse-brief
  ↓
Cloud Run reads file content → sends to Gemini with extraction prompt
  ↓
Gemini returns structured JSON:
  [
    { "task": "MVP Launch", "deadline": "2025-07-01", "priority": "high" },
    { "task": "Beta Testing", "deadline": "2025-07-15", "priority": "medium" }
  ]
  ↓
Cloud Run creates Google Calendar events with 20% time buffer
  ↓
User receives Slack/FCM notification:
  "📅 2 milestone dari project_brief.md ditambahkan ke Calendar!"
```

---

## 7. Milestones & Development Timeline

### Phase 1 — Hackathon MVP (5 days)

#### 🗓️ Day 1 — Foundation & Cloud Setup

| Milestone | Deadline | Priority | Owner |
|---|---|---|---|
| Kickoff: finalize scope, assign roles, setup repo | 09:00 | 🔴 Critical | All |
| Setup Google Cloud project + enable all APIs | 10:00 | 🔴 Critical | Backend |
| Firestore schema design & initialization | 11:30 | 🔴 Critical | Backend |
| Deploy base Cloud Run Flask app (hello world) | 13:00 | 🔴 Critical | Backend |
| Vertex AI Gemini 2.5 Flash — first call working | 15:00 | 🔴 Critical | Backend |
| VSCode Extension scaffolding (TypeScript boilerplate) | 15:00 | 🔴 Critical | Frontend |
| End-of-day sync: integration check & blockers review | 17:00 | 🟡 High | All |

#### 🗓️ Day 2 — Core Intelligence

| Milestone | Deadline | Priority | Owner |
|---|---|---|---|
| Aladhan API integration + prayer time logic by location | 10:00 | 🔴 Critical | Backend |
| Activity tracking in VSCode Extension (keystrokes, saves, git) | 11:00 | 🔴 Critical | Frontend |
| Focus state classifier: idle / warming-up / deep-focus / frustrated | 13:00 | 🔴 Critical | Backend |
| VSCode Extension → Cloud Run event POST working end-to-end | 14:30 | 🔴 Critical | Frontend + Backend |
| Gemini prompt engineering: mood-aware message generation | 16:00 | 🟡 High | Backend |
| Cloud Scheduler setup (30-min periodic check) | 17:00 | 🟡 High | Backend |
| End-of-day sync: demo core loop (code → event → reminder) | 17:30 | 🟡 High | All |

#### 🗓️ Day 3 — Integrations & Notifications

| Milestone | Deadline | Priority | Owner |
|---|---|---|---|
| Firebase Cloud Messaging (FCM) push notification setup | 10:00 | 🔴 Critical | Backend |
| Google Calendar API integration (create events) | 11:30 | 🟡 High | Backend |
| `project_brief.md` milestone parser (Gemini extraction → JSON) | 13:30 | 🟡 High | Backend |
| Calendar auto-push from parsed milestones (with 20% buffer) | 15:00 | 🟡 High | Backend |
| Slack webhook integration (DM + channel notifications) | 16:00 | 🟢 Medium | Backend |
| Google Tasks API — sub-task creation from milestones | 17:00 | 🟢 Medium | Backend |
| End-of-day sync: test full milestone parser flow live | 17:30 | 🟡 High | All |

#### 🗓️ Day 4 — Polish, UX & Wow Features

| Milestone | Deadline | Priority | Owner |
|---|---|---|---|
| VSCode status bar UI: focus state + session timer display | 10:00 | 🟡 High | Frontend |
| Meal reminder logic (time-since-last-meal inference) | 11:00 | 🟡 High | Backend |
| Context-aware azan mute (mic activity detection) | 12:30 | 🟢 Medium | Frontend |
| Wellness streak tracker (daily score calculation, Firestore) | 14:00 | 🟢 Medium | Backend |
| Team Sync Mode — Slack presence API + group lunch nudge | 15:30 | 🟢 Medium | Backend |
| Sprint plan generator from `project_brief.md` (Gemini full plan) | 16:30 | 🟢 Medium | Backend |
| Manual QA: test all 6 pillars end-to-end | 17:30 | 🔴 Critical | All |

#### 🗓️ Day 5 — Demo, Polish & Submission

| Milestone | Deadline | Priority | Owner |
|---|---|---|---|
| Bug fixes from Day 4 QA | 10:00 | 🔴 Critical | All |
| Weekly wellness report card (Slack DM formatting) | 11:00 | 🟡 High | Backend |
| Demo environment setup (pre-seeded Firestore data, fake session) | 12:00 | 🔴 Critical | All |
| Record backup demo video (in case live demo fails) | 13:00 | 🔴 Critical | All |
| Rehearse live demo walkthrough (2-minute pitch × 3 runs) | 14:00 | 🔴 Critical | All |
| Final README, architecture diagram, submission form | 15:30 | 🔴 Critical | All |
| Submit + deploy production Cloud Run instance | 17:00 | 🔴 Critical | Backend |
| 🎉 Done — istirahat, makan, solat Maghrib on time (DevAura-approved) | 18:00 | 🔴 Critical | All |

### Phase 2 — Post-Hackathon (Month 1–2)

| Milestone | Target | Priority |
|---|---|---|
| Chrome Extension (meeting detection) | Week 3 | 🟡 High |
| Team Sync Mode (Slack presence API) | Week 4 | 🟢 Medium |
| Burnout Prediction Engine (ML model) | Month 2 | 🟡 High |
| Mobile app (Flutter) | Month 2 | 🟢 Medium |
| Wellness Streak gamification UI | Month 2 | 🟢 Medium |
| Public beta launch | Month 2, end | 🔴 Critical |

### Phase 3 — Scale (Month 3–6)

| Milestone | Target | Priority |
|---|---|---|
| Multi-language support (EN, MS, AR) | Month 3 | 🟡 High |
| Wearable integration (Garmin, Fitbit) | Month 4 | 🟢 Medium |
| Company/team dashboard | Month 4 | 🟡 High |
| Marketplace listing (VSCode Marketplace) | Month 5 | 🔴 Critical |
| 1,000 active users | Month 6 | 🔴 Critical |

---

## 8. Demo Script (Hackathon 2-Minute Pitch)

```
00:00 — Open VSCode with a messy React project
        "Ini gue, 11 malam, lagi debug sesuatu yang harusnya simpel."

00:20 — DevAura status bar shows: 🔴 Deep Focus | 6h 42m coded today
        "DevAura detects I've been in deep focus for 3 hours.
         It queued all my reminders — didn't interrupt me."

00:35 — Simulate idle (stop typing for 5 sec)
        Notification pops: "Udah hampir 7 jam bro. Minum air dulu,
        terus cek — Isya udah belum?"
        "It knows I'm Muslim. It knows I might have missed Isya."

00:50 — Open project_brief.md in VSCode
        "Now watch this. I just opened my project brief."

01:00 — DevAura detects file, processes for 3 seconds
        Calendar notification: "📅 4 milestones added to your Google Calendar"
        Show Google Calendar — events are there with buffer time.
        "It read my markdown, understood the deadlines, and
         scheduled everything. I didn't type a single thing."

01:20 — Show the weekly wellness report card
        "Last week: 76/100. Solat on time 4/5 days, 
         missed lunch twice, slept after midnight 3 times."
        "This is data I've never had about myself before."

01:40 — Close with the team mode: Slack message 
        "Hey team, @dzaki is heading for Asr 🕌 — back in 15"
        "This is what psychological safety looks like in a dev team."

02:00 — "DevAura. Because great code starts with a great human."
```

---

## 9. Value Proposition

| User Pain | DevAura Solution | Measurable Outcome |
|---|---|---|
| Miss prayer times while coding | Real-time solat reminder with context-awareness | ≥4 prayers on time per day |
| Skip meals in flow state | Meal tracking + nearby food suggestions | 3 meals logged per day |
| Project deadlines in markdown never reach Calendar | Auto-parse + push milestones to Google Calendar | 100% milestones tracked |
| Can't tell when developer is burning out | Burnout prediction 3 days ahead | Proactive recovery, not reactive |
| Generic, annoying notifications | Mood-aware Gemini-generated messages | Higher reminder response rate |
| Remote team feels disconnected | Team Slack sync for prayers + breaks | Stronger team rituals |

---

## 10. Competitive Landscape

| Tool | What it does | What DevAura adds |
|---|---|---|
| WakaTime | Tracks coding time | Wellness + prayer + meals |
| RescueTime | Productivity analytics | AI nudges, not just data |
| Calm / Headspace | Meditation reminders | Developer-native, code-aware |
| Notion Reminders | Task deadlines | Auto-parse from markdown, Calendar integration |
| Prayer apps (Muslim Pro) | Prayer times | Integrated into dev workflow |

**Unique Position:** DevAura is the only tool that sits inside the coding environment, understands the developer's mental state, integrates Islamic practice, and automates project planning — simultaneously.

---

## 11. Business Model (Post-Hackathon)

| Tier | Price | Features |
|---|---|---|
| **Free** | Rp 0 | Solat reminders, basic meal nudges, 3 milestones/month |
| **Pro** | Rp 49.000/mo | Unlimited milestones, burnout prediction, mood-aware AI, wellness report |
| **Team** | Rp 299.000/mo per team | All Pro features + team Slack sync, shared leaderboard, manager dashboard |

---

## 12. Team

| Role | Responsibility |
|---|---|
| Backend Engineer | Cloud Run, Firestore, Vertex AI, API integrations |
| Frontend Engineer | VSCode Extension, Chrome Extension, notification UI |
| AI/Prompt Engineer | Gemini prompt design, mood detection, brief parsing logic |
| Designer (optional) | Wellness report cards, streak UI, onboarding flow |

---

## 13. Resources & Links

- [Vertex AI Gemini API Docs](https://cloud.google.com/vertex-ai/docs/generative-ai/start/quickstarts/quickstart-multimodal)
- [Aladhan Prayer Times API](https://aladhan.com/prayer-times-api)
- [Google Calendar API](https://developers.google.com/calendar/api/guides/overview)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [VSCode Extension API](https://code.visualstudio.com/api)
- [Cloud Run Quickstart](https://cloud.google.com/run/docs/quickstarts/build-and-deploy/deploy-python-service)
- [Firestore Getting Started](https://firebase.google.com/docs/firestore/quickstart)

---

*DevAura — Because great code starts with a great human.*

*Last updated: {{ auto-generated by DevAura milestone parser }}*