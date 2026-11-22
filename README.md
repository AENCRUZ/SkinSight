# SKINSIGHT

**AI-assisted skin health preparation tool** (academic project)

🌐 **Live demo:** [https://aencruz.github.io/SkinSight/](https://aencruz.github.io/SkinSight/)

SKINSIGHT helps people **document a skin concern, prepare a summary for a dermatologist, find listed clinics, and keep a personal medication list**. It is **not** a diagnostic tool: it does not name conditions, prescribe or recommend medication, or replace a doctor. In an emergency, contact emergency services.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat&logo=supabase&logoColor=white)

---

## Features and current status

| Feature | Status | Notes |
|---|---|---|
| **AI Skin Assistant** | Working | Gemini-powered intake chat. It records what you report, asks follow-up questions and may give brief *general* skin-health information. It is instructed never to name possible conditions or recommend medicines, and a second automatic check on its replies enforces this. Optional photo (JPEG/PNG/WebP, up to 5 MB). |
| **Knowledge retrieval (RAG)** | Working | Hybrid retrieval over a small curated intake knowledge base (`backend/src/data/knowledgeBase.json`): Gemini embeddings (`gemini-embedding-001`) plus keyword scoring. Falls back to keyword-only if embeddings fail. |
| **Consultation summary** | Working | Structured summary of *what the user reported* ("Not reported" for anything not said). TXT and PDF download, copy. Built from validated fields only. |
| **Saved consultations (history)** | Working | Each consultation is saved to the user's account (text only, never photos) and can be reopened after signing out and back in, or on another device. Delete from the history panel. Requires the database table in `supabase/migrations/`. |
| **Authentication** | Working | Email/password, Google sign-in and password reset through Supabase. AI pages require a login (enforced in the browser *and*, when `REQUIRE_AUTH=true`, on the server). |
| **Find a Dermatologist** | Working, **demo coverage** | Search or pin any place; clinics are listed for **Batangas Province, Philippines only** (27 entries). Elsewhere the page says so. **Clinic details (hours, phones, emails, doctors) are not independently verified**; open/closed is computed from the *listed* hours. See `docs/clinic-data-review.md`. |
| **Clinic inquiry email** | Working | Opens a Gmail draft in the user's own account with a message built from their real summary and the fields they type. SKINSIGHT sends nothing. Disabled until there is a real concern to share. |
| **Medication tracker** | Working (browser-local) | Stored **only in this browser, on this device**, separately for the guest and each account. No reminders or notifications, no sync or backup. Can be deleted from the medication pages. |
| **Terms of Use / Privacy Policy** | Draft | `frontend/terms.html`, `frontend/privacy.html`. Written from what the app actually does; open items (provider retention periods, database region, account deletion, contact address, legal review, age policy) are listed on the pages. Not legal advice. |
| Account deletion | Not implemented | No self-service option yet. |
| Clinics outside Batangas | Not implemented | See `docs/dermatologist-directory-expansion.md`. |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Static HTML, CSS and vanilla JavaScript (no build step). Fonts: Montserrat and Open Sans. jsPDF for PDF download. Hosted on GitHub Pages. |
| Backend | Node.js (18+) and Express 4: `cors`, `express-rate-limit`, `multer` (in-memory uploads), `dotenv`. Hosted on Render. |
| AI | Google Gemini via `@google/generative-ai` (chat/summary model set by `GEMINI_MODEL`, embeddings by `GEMINI_EMBEDDING_MODEL`). |
| Authentication | Supabase Auth (email/password and Google). |
| Database | Supabase Postgres: **one table**, `public.consultations`, with row-level security. |
| Maps and places | Google Maps embeds/links; OpenStreetMap Nominatim for place search. No API keys are needed for these. |

---

## Project structure

```
SkinSight/
├── frontend/                     # Static site (deployed to GitHub Pages)
│   ├── css/
│   │   ├── tokens.css            # Design tokens: brand colors, type, spacing, radii, shadows
│   │   ├── style.css             # Base, shared shell (navbar, footer), buttons, forms, components
│   │   ├── auth.css, auth-pages.css   # Account menu, login gate, login/signup pages
│   │   ├── home.css, chat.css, features.css, medication-tracker.css
│   │   └── legal.css             # Terms and Privacy pages
│   ├── js/
│   │   ├── ui.js                 # <site-header>/<site-footer>, mobile nav, icon sprite
│   │   ├── supabase-config.js    # Supabase client (public anon key, session storage rules)
│   │   ├── auth.js, auth-ui.js   # Auth flows, account menu, password hints
│   │   ├── login-gate.js         # Login gate for AI pages, clinic summary gate
│   │   ├── api.js                # Backend client: timeouts, one retry, typed errors
│   │   ├── chat.js, chat-ui.js   # Chat controller, history sidebar
│   │   ├── history-store.js      # Saved consultations (Supabase table access)
│   │   ├── summary.js            # Summary page, TXT/PDF/copy
│   │   ├── clinics-data.js       # The 27 clinic entries, coverage regions, open-status helper
│   │   ├── clinic-finder.js      # Finder: search, filters, distance, coverage handling
│   │   └── medication-store.js, meds-ui.js   # Browser-local medication tracker
│   ├── *.html                    # index, about, ai-assistant-intro, ai-chat, consultation-summary,
│   │                             # clinic-finder, clinic-details, no-clinic-available, medication-*,
│   │                             # add-medication, login, signup, forgot/reset-password, terms, privacy
│   └── img/                      # SVG illustrations and favicon
│
├── backend/                      # Node.js + Express AI API
│   ├── server.js                 # Entry point
│   ├── src/
│   │   ├── app.js                # CORS, limits, rate limiting, error handling
│   │   ├── config/aiConfig.js    # Gemini client and model names
│   │   ├── routes/chatRoutes.js
│   │   ├── controllers/chatController.js
│   │   ├── middleware/           # auth.js, upload.js (magic-byte check), validateChat.js
│   │   ├── services/             # aiService, ragService, safetyFilter, summaryValidator, reportService
│   │   ├── prompts/systemPrompt.js
│   │   └── data/knowledgeBase.json
│   ├── test/                     # 37 automated tests (no network)
│   ├── test-rag.js               # RAG check script (calls Gemini if a key is set)
│   ├── CHANGES-FOR-REVIEW.md     # Change log for the backend owner
│   └── .env.example
│
├── supabase/migrations/001_consultations.sql   # The one database table + security rules
├── docs/                         # clinic-data-review.md, dermatologist-directory-expansion.md
└── .github/workflows/deploy-pages.yml          # Publishes frontend/ to GitHub Pages on push to main
```

---

## Getting started (local)

### Prerequisites
- A modern browser
- Node.js 18+ (Node 22+ recommended; `npm test` uses a glob that older Windows shells do not expand)
- A [Google Gemini API key](https://aistudio.google.com/app/apikey)
- The Supabase project's URL and **public anon key** (already set in `frontend/js/supabase-config.js`)

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env     # then edit .env (never commit it)
npm run dev              # http://localhost:5000
```
Set at least `GEMINI_API_KEY`. Leave `REQUIRE_AUTH` unset or `false` for local use (requests without a login are treated as a guest).

### 2. Frontend
Serve `frontend/` with any static server:
```bash
python -m http.server 8000 --directory frontend     # or: npx serve frontend
```
Open <http://localhost:8000>. Pages on `localhost` talk to `http://localhost:5000`; deployed pages talk to the Render URL set in `frontend/js/api.js`.

> Google sign-in needs `http://localhost` or `https://`; opening files with `file://` does not work.

### 3. Tests
```bash
cd backend && npm test            # 37 tests, no network or API key needed
npm run test:rag                  # optional; calls Gemini if GEMINI_API_KEY is set
```

---

## Configuration

### Backend environment variables (`backend/.env`, or Render → Environment)
Names only. **Never put values in the repository.**

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google Gemini key (secret). |
| `GEMINI_MODEL` | No | Chat/summary model. Default `gemini-3.1-flash-lite`. |
| `GEMINI_EMBEDDING_MODEL` | No | Default `gemini-embedding-001` (the old `text-embedding-004` has been retired). |
| `CLIENT_ORIGIN` | Production | Comma-separated exact origins allowed by CORS, e.g. `https://aencruz.github.io`. |
| `SUPABASE_URL` | For login checks | Supabase project URL (must be the **same project as the frontend**). |
| `SUPABASE_ANON_KEY` | For login checks | The public anon key (same as the frontend). `SUPABASE_SERVICE_ROLE_KEY` is only an optional fallback and is a secret. |
| `REQUIRE_AUTH` | **Production: `true`** | When `true`, every AI request needs a valid login (401 otherwise; 503 if Supabase is not configured). When unset, requests continue as a guest (development only). |
| `NODE_ENV` | Production: `production` | Stops localhost origins being trusted by CORS. |
| `PORT` | No | Default 5000 (Render sets it). |

### Supabase setup
1. **Auth → URL Configuration:** set the Site URL and add redirect URLs for every place the site is served (the deployed origin and path, and `http://localhost:8000/**`). Password reset and Google sign-in redirect back to pages in the same folder as the page the user was on.
2. **Auth → Providers:** enable Email and Google (Google needs its OAuth client configured).
3. **Database:** run `supabase/migrations/001_consultations.sql` once in the SQL Editor of the **same project the frontend uses**. It only adds the `consultations` table (50 per account, row-level security: users can only access their own rows, no access for signed-out visitors). It is safe to run again.

### Render (backend)
Create a Node web service from the `backend/` folder (build `npm install`, start `npm start`), set the environment variables above, and put the service URL in `PRODUCTION_API_URL` in `frontend/js/api.js`. Instances can sleep when idle (as on Render's free plan) and then take up to a minute to wake; the chat page explains this to the user.

### GitHub Pages (frontend)
Pushing to `main` runs `.github/workflows/deploy-pages.yml`, which publishes the `frontend/` folder.

---

## API (backend)

| Method and path | Purpose |
|---|---|
| `GET /api/health` | Liveness check (public). |
| `POST /api/chat/message` | One chat turn. Multipart: `message`, `history` (JSON), optional `image`. Limits: message ≤ 2,000 chars, history ≤ 40 turns, image ≤ 5 MB. |
| `POST /api/chat/summary` | Structured summary from the conversation (JSON `{ history }`). Returns 502 if a reliable summary cannot be produced; it never returns invented content. |
| `POST /api/chat/download` | Plain-text report built from validated summary fields. |
| `GET /api/chat/knowledge/search?q=`, `GET /api/chat/knowledge/stats` | Knowledge-base diagnostics (login required in strict mode). |

All `/api/chat/*` routes are rate-limited (20 requests per minute per IP). Errors return `{ success: false, error }` with no internal details.

---

## Frontend notes

### Page shell
Every page uses the same three pieces, so the navbar and footer live in one place (`js/ui.js`):

```html
<site-header data-nav="home|assistant|clinics|meds|about|none"></site-header>
<main id="main"> ... </main>
<site-footer></site-footer>
```
Load `js/ui.js` synchronously in `<head>`. To add a page, copy an existing one, link `css/tokens.css` and `css/style.css` (plus `css/auth.css` for the account menu) and set `data-nav`.

### DOM hooks other scripts depend on
Rename these and something breaks:
- **Navbar:** `.navbar`, `.nav-links`, `.nav-login-item`, `.nav-auth-actions`, `#nav-toggle`, `#btn-supabase-logout`.
- **Auth forms:** `[data-auth-form]`, `[data-auth-note]`, `[data-auth-success]`, `[data-reset-expired]`, `[data-toggle-password]`, `[data-google-login]`, and the `login-*` / `signup-*` / `reset-email` / `update-*` ids. Submit buttons and the Google label must contain plain text only.
- **Chat:** `.chat-body`, `.chat-inputbar textarea`, `.chat-inputbar button.send`, `#attach-toggle`, `.attach-panel input[type=file]`, `.chat-cta a`; history panel `#chatApp`, `#chatShell`, `#chatSidebar`, `#historyList`, `#historyFoot`, `#newConsultBtn`, `#historySearch`.
- **Summary:** the `#summary*` ids, `#printableSummary`, `#downloadTxtBtn`, `#downloadPdfBtn`, `#copySummaryBtn`, `#summaryError`, `#summaryRetryBtn`, `.copy-confirm`.
- **Clinics:** `#clinic-q`, `#useLocationBtn`, `#f-distance`, `#f-availability`, `#f-type`, `#clinicsList`, `#resultsCount`, `#mapModal`; the inquiry fields on `clinic-details.html`.

### Brand
Colors `#03045E` `#0077B6` `#00B4D8` `#90E0EF` `#CAF0F8` (tokens in `css/tokens.css`); headings in **Montserrat**, body text in **Open Sans**.

### Where data lives in the browser
- **Sign-in:** `sessionStorage` for a normal login; `localStorage` only when "Keep me signed in" is ticked (`js/supabase-config.js`). Code that reads the signed-in user (`login-gate.js`, `medication-store.js`) checks the same places.
- **Open consultation and summary, pinned place, filters, device position:** `sessionStorage` (cleared on sign-out or tab close). Precise device position is never put in `localStorage`.
- **Saved consultations:** the `consultations` table (not the browser).
- **Medication tracker:** `localStorage`, keys `skinsight_meds_v1:<profile>` and `skinsight_medlog_v1:<profile>` where `<profile>` is `guest` or `u_<user id>`. This separates profiles on one browser; it is **not** security (plain text, readable by anyone using that browser profile). Deleting is offered on each medication page.

### Third-party scripts
`supabase-js` and `jsPDF` are loaded from CDNs at **pinned versions with Subresource Integrity** hashes. To upgrade, change the version in the `<script>` tag on every page and replace the hash:
```bash
curl -sL https://cdn.jsdelivr.net/npm/@supabase/supabase-js@<version>/dist/umd/supabase.min.js | openssl dgst -sha384 -binary | openssl base64 -A
```

### Accessibility
Checked with axe-core (WCAG 2.0/2.1/2.2 A and AA plus best practices) on every page at 375, 768 and 1280 px in November 2026: no violations, no horizontal overflow. Keyboard operation, visible focus and reduced-motion support are part of the component styles. Re-run the check after UI changes.

---

## Privacy and safety in short
- Messages (and photos, if attached) go to the SKINSIGHT server and then to Google's Gemini service. Photos are held in memory only and are not saved; saved consultations contain text only.
- The clinic inquiry opens the user's own email; SKINSIGHT sends nothing.
- Medication data never leaves the browser.
- The full, honest list (including what is *not yet known*) is in [`frontend/privacy.html`](frontend/privacy.html). Terms are in [`frontend/terms.html`](frontend/terms.html).
- Before going live: set `REQUIRE_AUTH=true`, `NODE_ENV=production`, the Supabase variables, and run the migration.

---

## Known limitations and next steps
- Clinic directory: 27 Batangas entries, unverified; see `docs/clinic-data-review.md` and `docs/dermatologist-directory-expansion.md`.
- No account-deletion flow, no reminders/notifications, no cross-device medication sync.
- Place search uses the public Nominatim service, which is not meant for heavy traffic.
- The privacy policy and terms need an owner review (contact address, governing law, age policy, provider retention terms).

## Contributors
Built by the SKINSIGHT team. Contributions in the Git history include work by **AENCRUZ**, **Lemuel** (backend, AI and retrieval, clinic finder) and **jimuelperez** (early medication tracker and login-gate work).

---

## License
This project is for educational purposes.
