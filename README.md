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
├── css/
│   ├── style.css              # Main site styles
│   └── auth.css               # Authentication page styles
├── js/
│   ├── supabase-config.js     # Supabase client initialization
│   ├── auth.js                # Authentication logic (email + Google OAuth)
│   └── site.js                # UI polish (scroll animations, navbar, carousel)
├── index.html                 # Home / landing page
├── login.html                 # Log in page
├── signup.html                # Sign up page
├── forgot-password.html       # Password reset page
├── ai-assistant-intro.html    # AI assistant introduction
├── ai-chat.html               # AI chat interface
├── consultation-summary.html  # Consultation summary viewer
├── clinic-finder.html         # Dermatologist clinic search
├── clinic-details.html        # Individual clinic details
├── no-clinic-available.html   # No clinics found fallback
├── medication-tracker.html    # Medication tracking dashboard
├── add-medication.html        # Add a new medication
├── medication-history.html    # Medication history log
├── about.html                 # About page
├── .gitignore
└── README.md
```

---

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Edge, Safari)

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/SkinSight.git
cd SkinSight
```

### 2. Run the App

This is a static HTML/CSS/JS site — no build step required. You can:

- **Open directly**: Double-click `index.html` in your file explorer.
- **Use a local dev server** (recommended for OAuth redirects):
  ```bash
  # Using Python
  python -m http.server 8000

  # Or using Node.js
  npx serve .
  ```
  Then open [http://localhost:8000](http://localhost:8000) in your browser.

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

