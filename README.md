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

- **AI Skin Assistant** — Conversational interface to describe and organize skin concerns
- **Skin Image Assessment** — Upload photos of visible skin concerns for general, non-diagnostic observations
- **Find a Dermatologist** — Search for nearby dermatology clinics with contact details
- **Medication Tracker** — Track prescribed medications, schedules, and doses
- **Authentication** — Email/password sign-up and login, Google OAuth, and password reset via Supabase

---

## Project Structure

```
SkinSight/
├── frontend/                     # Client-facing web application
│   ├── css/
│   │   ├── style.css             # Main styling
│   │   └── auth.css              # Authentication styling
│   ├── js/
│   │   ├── api.js                # Client helper for backend AI endpoints
│   │   ├── chat.js               # Chatbot UI, photo upload & messaging logic
│   │   ├── summary.js            # Summary report generator & download handler
│   │   ├── supabase-config.js    # Supabase client initialization
│   │   ├── auth.js               # Authentication logic (email + Google OAuth)
│   │   ├── login-gate.js         # Route guard for protected pages
│   │   └── site.js               # UI polish (animations, navbar, carousel)
│   ├── index.html                # Landing page
│   ├── ai-chat.html              # AI Assistant chat interface
│   ├── consultation-summary.html # Consultation summary viewer & downloader
│   ├── clinic-finder.html        # Dermatologist clinic search
│   ├── clinic-details.html       # Individual clinic details
│   ├── no-clinic-available.html  # No clinics found fallback
│   ├── medication-tracker.html   # Medication tracking dashboard
│   ├── add-medication.html       # Add a new medication
│   ├── medication-history.html   # Medication history log
│   ├── login.html                # Log in page
│   ├── signup.html               # Sign up page
│   ├── forgot-password.html      # Password reset request
│   ├── reset-password.html       # Password reset confirmation
│   └── about.html                # About page
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

