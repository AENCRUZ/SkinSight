# SKINSIGHT

**AI-Assisted Skin Health Platform**

🌐 **Live Demo:** [https://aencruz.github.io/SkinSight/](https://aencruz.github.io/SkinSight/)

SKINSIGHT helps users document skin concerns, prepare for dermatology consultations, find nearby dermatologists, and track prescribed skin medications. It is **not** a diagnostic tool. It organizes information so users can make the most of their doctor visits.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat&logo=supabase&logoColor=white)

---

## Features

**Working** means it runs end to end. **Preview** means the interface is built with sample data and is
clearly labeled "Preview" / "Sample data" in the UI; nothing is saved or sent.

| Feature | Status | Notes |
|---|---|---|
| AI Skin Assistant | Working | Gemini-powered intake chat with starter prompts, markdown replies and an auto-growing composer |
| Skin image assessment | Working | Attach or take a photo in the chat (JPEG/PNG/WebP, up to 5 MB) for non-diagnostic observations |
| Consultation summary | Working | Structured summary with TXT and PDF download and copy-to-clipboard |
| Conversation history sidebar | Preview | New consultation, search, date groups, delete and revisit. Real conversations live only in the browser session (`sessionStorage`) and are cleared on sign-out. Sample conversations are labeled. See `REAL_HISTORY_API` at the bottom of `frontend/js/chat-ui.js` for the backend work needed to persist history |
| Authentication | Working | Email/password, Google OAuth and password reset via Supabase |
| Find a Dermatologist | Preview | Sample clinics; search and filters are disabled |
| Email / appointment request | Preview | Simulated. Nothing is sent to any clinic |
| Medication tracker | Working (browser-local) | Add medications (dialog or full page), daily schedule, mark doses complete / undo, remove / undo, as-needed list, history with filters and progress. Saved **only in this browser on this device**, separately for the guest and each signed-in account: not synced, not backed up, not private on a shared device. It sends **no notifications or reminders**, cannot verify that a dose was taken, and gives no medical advice. Includes controls to delete the data. See "Medication tracker storage" below |

---

## Project Structure

```
SkinSight/
├── frontend/                     # Static site (deployed to GitHub Pages)
│   ├── css/
│   │   ├── tokens.css            # Design tokens: color, type, spacing, radii, shadows, motion
│   │   ├── style.css             # Base, shared shell (navbar, footer), buttons, forms, components
│   │   ├── auth.css              # Navbar account menu, sign-out and login-gate modals
│   │   ├── home.css              # Home page
│   │   ├── chat.css              # AI chat app, history sidebar, assistant intro, summary page
│   │   ├── features.css          # Clinics and About pages (+ Preview components, shared form helpers)
│   │   ├── medication-tracker.css # Medication tracker, add form, history, dialogs
│   │   └── auth-pages.css        # Login, sign-up, forgot / reset password
│   ├── js/
│   │   ├── ui.js                 # <site-header>/<site-footer>, mobile nav drawer, icon sprite
│   │   ├── site.js               # Scroll-reveal and navbar scroll effect
│   │   ├── supabase-config.js    # Supabase client (public anon key)
│   │   ├── auth.js               # Auth flows and navbar account menu
│   │   ├── auth-ui.js            # Password strength / match / Caps Lock hints (presentation only)
│   │   ├── login-gate.js         # Login gate and simulated appointment modal (Preview)
│   │   ├── api.js                # Client for the backend AI endpoints
│   │   ├── chat.js               # Chat controller: messages, photo upload, session history
│   │   ├── chat-ui.js            # Chat polish and the conversation history sidebar
│   │   ├── summary.js            # Summary rendering, TXT/PDF download, copy
│   │   ├── medication-store.js   # Browser-local medication data (per profile), schedules, history
│   │   └── meds-ui.js            # Medication pages: dialog/form, doses, undo, history, data deletion
│   ├── img/                      # SVG illustrations and favicon
│   ├── index.html                # Home
│   ├── ai-assistant-intro.html   # AI assistant introduction
│   ├── ai-chat.html              # Chat + conversation history
│   ├── consultation-summary.html # Summary viewer and downloads
│   ├── clinic-finder.html        # Clinic search (Preview)
│   ├── clinic-details.html       # Clinic details and summary sharing (Preview)
│   ├── no-clinic-available.html  # Self-care fallback (Preview)
│   ├── medication-tracker.html   # Medication tracker (browser-local)
│   ├── add-medication.html       # Add medication, full-page form (browser-local)
│   ├── medication-history.html   # Medication history (browser-local)
│   ├── login.html / signup.html / forgot-password.html / reset-password.html
│   └── about.html
│
├── backend/                      # Node.js + Express AI API
│   ├── src/
│   │   ├── config/
│   │   │   └── aiConfig.js       # Google Gemini SDK setup
│   │   ├── controllers/
│   │   │   └── chatController.js # Chat, image upload, & report handlers
│   │   ├── middleware/
│   │   │   └── upload.js         # Multer in-memory photo upload middleware
│   │   ├── prompts/
│   │   │   └── systemPrompt.js   # Non-diagnostic clinical intake guardrails
│   │   ├── routes/
│   │   │   └── chatRoutes.js     # API routes (/api/chat/*)
│   │   ├── services/
│   │   │   ├── aiService.js      # Multimodal AI calls & intake questioning
│   │   │   └── reportService.js  # Text report formatting & file builder
│   │   └── app.js                # Express app setup & CORS configuration
│   ├── .env                      # API keys & PORT (not committed)
│   ├── .env.example              # Environment variables template
│   ├── package.json              # Backend dependencies
│   └── server.js                 # Server entry point
│
├── .gitignore
└── README.md
```

---

## Getting Started

### Prerequisites

- Modern Web Browser (Chrome, Firefox, Edge, Safari)
- Node.js (v18 or higher) and npm

---

### 1. Set Up and Run the Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure your API key:
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Get a free Google Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
   - Set `GEMINI_API_KEY=your_key_here` in `backend/.env`.
4. Start the backend server:
   ```bash
   npm run dev
   ```
   The backend API will run at `http://localhost:5000`.

---

### 2. Run the Frontend

In a separate terminal, serve the `frontend/` directory using any local web server:

```bash
# Using Python
python -m http.server 8000 --directory frontend

# Or using Node.js npx serve
npx serve frontend
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

> **Note:** Google OAuth requires your app to be served over `http://localhost` or `https://`. Opening the HTML file directly via `file://` will **not** work for OAuth redirects.

---

## Frontend Notes

### Page shell
Every page uses the same three pieces, so the navbar and footer live in one place (`js/ui.js`):

```html
<site-header data-nav="home|assistant|clinics|meds|about|none"></site-header>
<main id="main"> ... </main>
<site-footer></site-footer>
```

Load `js/ui.js` synchronously in `<head>` so the shell renders during parsing. To add a page, copy an existing one,
link `css/tokens.css` and `css/style.css` (plus `css/auth.css` for the account menu), and set `data-nav`.

### DOM hooks other scripts depend on
Rename these and something breaks:
- **Navbar:** `.navbar`, `.nav-links`, `.nav-login-item`, `.nav-auth-actions`, `#nav-toggle` (a button that also exposes `.checked`, because `auth.js` assigns it).
- **Auth forms:** `[data-auth-form]`, `[data-auth-note]`, `[data-auth-success]`, `[data-reset-expired]`, `[data-toggle-password]`, `[data-google-login]`, and the `login-*` / `signup-*` / `reset-email` / `update-*` ids. Submit buttons and the Google label must contain plain text only; `auth.js` overwrites it while loading.
- **Chat:** `.chat-body`, `.chat-inputbar textarea`, `.chat-inputbar button.send`, `#attach-toggle`, `.attach-panel input[type=file]`, `.chat-cta a`, `#selected-image-preview` (created by `chat.js`).
- **Summary:** the `#summary*` ids, `#printableSummary`, `#downloadTxtBtn`, `#downloadPdfBtn`, `#copySummaryBtn`, `.copy-confirm`.

### Medication tracker storage
The medication tracker is **frontend-only**. Its data never leaves the browser: there is no API, database or
Supabase table behind it.

- **Where:** `localStorage`, in per-profile keys `skinsight_meds_v1:<profile>` and `skinsight_medlog_v1:<profile>`.
  `<profile>` is `guest` when nobody is signed in, or `u_<Supabase user id>` for an account. A profile only reads its own
  keys, so signing out or switching accounts never shows another profile's medications. Guest data is **not** migrated
  into an account.
- **Which account is active:** read from the Supabase session token that supabase-js stores in `localStorage`
  (`sb-*-auth-token`), parsed the same way `js/auth.js` parses it. The token is the source of truth, so a stale
  `skinsight_user` cache without a session never unlocks an account's data. Nothing in `auth.js` was changed.
- **Limits (also disclosed in the UI):** this is isolation, not security. The data is plain text under predictable keys;
  anyone who can use the browser profile can read it, and it stays on the device after sign-out until deleted. It is
  not synced across devices or browsers, not backed up, and is lost when browser data is cleared or in private
  browsing. On GitHub Pages the origin (`<user>.github.io`) is shared by every project site under the same account.
- **Deleting:** the notice on each medication page has "Delete medication data on this device" (this profile, or every
  profile plus data from earlier prototype versions).
- **Storage unavailable or full:** the store keeps working in memory for the life of the page and the UI says plainly
  that nothing is being saved.
- **What it does not do:** send notifications or reminders, verify that a dose was taken (doses the user did not mark
  are shown as "Not logged", not "missed"), or give medical advice.
- **Going further** (accounts that sync across devices) needs a backend: tables for medications and dose logs with
  row-level security on the user id, endpoints, and a migration path for existing browser-local data.

### Third-party scripts
`supabase-js` and `jsPDF` are loaded from CDNs at **pinned versions with Subresource Integrity** hashes, so a CDN
change cannot alter what runs. To upgrade, change the version in the `<script>` tag on every page and replace the hash:

```bash
curl -sL https://cdn.jsdelivr.net/npm/@supabase/supabase-js@<version>/dist/umd/supabase.min.js | openssl dgst -sha384 -binary | openssl base64 -A
```

### Accessibility and performance
Audited with axe-core across every page and its interactive states (menus, modals, drawers, error states) against
WCAG 2.0/2.1/2.2 A and AA plus best practices, with zero violations at the time of writing. Keyboard operation, visible
focus, reduced-motion support and 44 px touch targets are part of the component styles. On a throttled mobile profile
(4x CPU, 4G) pages reach first contentful paint in about 0.7 s and largest contentful paint under 1.5 s with no layout shift.

---

## Authentication Flow

### Email/Password
1. User signs up with email, password, and display name on `signup.html`.
2. User logs in on `login.html` with email and password.
3. If the user forgets their password, they can request a reset link on `forgot-password.html`.

### Google OAuth
1. User clicks **"Continue with Google"** on the login or signup page.
2. The app calls `supabaseClient.auth.signInWithOAuth({ provider: "google" })`.
3. The browser redirects to Google's consent screen.
4. After approval, Google redirects back to Supabase's callback URL.
5. Supabase redirects the user back to the app with session tokens in the URL hash.
6. The app detects the tokens, stores the session, and redirects to the home page.

### Session Management
- On every page load, the navbar checks for an active session.
- If logged in, the navbar shows the user's name/avatar and a **Log Out** button.
- If not logged in, the navbar shows **Log In** and **Sign Up** links.

---

## Important Notes

> ⚠️ **SKINSIGHT is not a substitute for professional medical advice, diagnosis, or treatment.** It is a preparation and organization tool only.

---

## Tech Stack

| Layer          | Technology                                        |
|----------------|---------------------------------------------------|
| Frontend       | HTML5, CSS3, Vanilla JavaScript                   |
| Authentication | [Supabase Auth](https://supabase.com/auth)        |
| Backend/DB     | [Supabase](https://supabase.com) (PostgreSQL)     |
| Hosting        | Any static hosting (GitHub Pages, Netlify, Vercel) |

---

## License

This project is for educational purposes.

