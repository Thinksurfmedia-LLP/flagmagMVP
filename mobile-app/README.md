# FlagMag Mobile App

This is the mobile-facing Next.js frontend for FlagMag. It runs as a standalone app and proxies all API calls to the main FlagMag backend server.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- The main FlagMag backend running (locally or hosted)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the API URL

Copy the example environment file and edit it:

```bash
# On Mac/Linux:
cp .env.example .env.local

# On Windows:
copy .env.example .env.local
```

Open `.env.local` and set `API_BASE_URL` to point to the backend:

| Scenario | Value |
|---|---|
| Running the main project locally | `http://localhost:3000` (default, no change needed) |
| Using a hosted/staging API | The full URL provided by the team (e.g. `https://api.flagmag.com`) |

### 3. Run the development server

Since the main backend already uses port 3000, run the mobile app on a different port:

```bash
npm run dev -- -p 3001
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

---

## How it works

All `/api/*` requests made by the mobile app are automatically **proxied** to the backend URL configured in `API_BASE_URL`. You do not need to change any API call URLs in the source code — just point `.env.local` at the right backend.

## Project structure

```
app/
  page.js          # Home / entry point
  layout.js        # Root layout
  login/           # Login screen
  signup/          # Sign-up screen
  welcome/         # Welcome / onboarding screen
  matches/         # Match listing and details
  components/      # Shared UI components
  lib/
    api.js         # Fetch wrapper (GET/POST/PUT/DELETE)
    AuthContext.js # Auth state provider
```

## Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (default port 3000) |
| `npm run dev -- -p 3001` | Start dev server on port 3001 |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
