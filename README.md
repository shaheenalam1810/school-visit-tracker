# School Visit Tracker

A mobile-first Next.js app for marketing executives to log school visits.
Every submission is appended as a new row directly into a Google Sheet
via a Google Apps Script Web API. **No database is used** — Google
Sheets is the only backend.

## Folder Structure

```
school-visit-tracker/
├── app/
│   ├── layout.tsx              # Root layout, fonts, providers
│   ├── globals.css             # Tailwind + base styles
│   ├── page.tsx                # Redirects to /login or /dashboard
│   ├── login/page.tsx          # Login page
│   ├── dashboard/page.tsx      # Dashboard (stats + visit list)
│   └── new-visit/page.tsx      # New Visit form
├── components/
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   ├── Textarea.tsx
│   ├── Select.tsx
│   ├── InterestPicker.tsx      # Hot / Warm / Cold segmented control
│   ├── Loader.tsx
│   ├── StatCard.tsx
│   ├── TopBar.tsx
│   └── ProtectedRoute.tsx
├── context/
│   ├── AuthContext.tsx         # Login/logout/session state
│   └── ToastContext.tsx        # Success/error toasts
├── lib/
│   ├── api.ts                  # Axios instance + API service functions
│   └── auth.ts                 # localStorage/sessionStorage helpers
├── types/
│   └── index.ts                # Shared TypeScript types
├── google-apps-script/
│   └── Code.gs                 # Apps Script backend (paste into Sheet)
├── .env.local.example
├── package.json
├── next.config.js
├── tailwind.config.ts
├── postcss.config.js
└── tsconfig.json
```

## 1. Google Sheets + Apps Script Backend Setup

1. Go to [sheets.google.com](https://sheets.google.com) and create a new
   blank spreadsheet, e.g. **"School Visit Tracker Data"**.
2. Open **Extensions > Apps Script**.
3. Delete the default `myFunction()` code and paste in the entire
   contents of `google-apps-script/Code.gs` from this project.
4. Save the project (e.g. name it "Visit Tracker API").
5. In the function dropdown at the top, select **`setup`** and click
   **Run**. Approve the permissions Google asks for.
   - This creates two sheets:
     - **Visits** — one row per submitted visit, with a `timestamp`
       column plus every form field.
     - **Users** — login credentials, pre-seeded with
       `admin / admin123`.
6. **Important:** open the **Users** sheet and replace the sample row
   with real usernames/passwords for your marketing executives (one
   row per person: `username | password | name`).
7. Click **Deploy > New deployment**.
   - Select type: **Web app**.
   - Description: anything, e.g. "v1".
   - Execute as: **Me**.
   - Who has access: **Anyone**.
8. Click **Deploy**, authorize again if prompted, and copy the **Web
   app URL** (it ends in `/exec`). This is your API endpoint.
9. Whenever you edit `Code.gs` later, go to **Deploy > Manage
   deployments > Edit (pencil icon) > New version > Deploy**, or your
   changes won't take effect on the live URL.

### API Reference

| Method | URL                              | Purpose                          |
|--------|-----------------------------------|-----------------------------------|
| POST   | `/exec`                           | `{ "action": "login", "username", "password" }` → `{ success, name }` |
| POST   | `/exec`                           | `{ "action": "addVisit", ...visit fields }` → `{ success, message }` |
| GET    | `/exec?action=visits`             | Returns `{ success, data: VisitRecord[] }` |

The frontend sends POST bodies as `text/plain` (not
`application/json`) on purpose — Apps Script web apps don't handle the
CORS pre-flight `OPTIONS` request that browsers send before a JSON
POST, so `text/plain` is used to avoid the pre-flight while Apps
Script still parses the body as JSON on the server (`JSON.parse(e.postData.contents)`).

## 2. Next.js App Setup

### Prerequisites
- Node.js 18.18+ and npm

### Install

```bash
cd school-visit-tracker
npm install
```

### Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and paste your Apps Script Web App URL:

```
NEXT_PUBLIC_APPS_SCRIPT_URL=https://script.google.com/macros/s/XXXXXXXXXXXXXXXXXXXXXXXX/exec
```

### Run locally

```bash
npm run dev
```

Visit `http://localhost:3000`. Log in with a username/password from
your **Users** sheet.

### Build for production

```bash
npm run build
npm run start
```

## 3. Deploying the Frontend

Any static/Node host that supports Next.js works. The simplest path:

### Deploy to Vercel
1. Push this project to a GitHub repository.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. In **Environment Variables**, add:
   - `NEXT_PUBLIC_APPS_SCRIPT_URL` = your Apps Script `/exec` URL
4. Click **Deploy**. Vercel builds and hosts the app automatically.

### Deploy elsewhere (Netlify, Render, your own server)
- Set the `NEXT_PUBLIC_APPS_SCRIPT_URL` environment variable in the
  host's dashboard.
- Build command: `npm run build`
- Start command: `npm run start`

## 4. How Data Flows

```
Executive fills New Visit form
        │
        ▼
Next.js app (axios) ──POST (text/plain JSON)──▶ Apps Script Web App (/exec)
        │                                              │
        │                                              ▼
        │                                   Appends row to "Visits" sheet
        ▼
Dashboard (axios) ──GET ?action=visits──▶ Apps Script Web App ──▶ reads "Visits" sheet ──▶ returns JSON
```

Login works the same way: the app POSTs `{ action: "login", ... }`
and Apps Script checks the credentials against the **Users** sheet.

## 5. Notes & Customization

- **Remember Login** stores the session in `localStorage` (persists
  across browser restarts). Unchecking it uses `sessionStorage`
  (cleared when the tab closes).
- "Today's Total Visits" and "My Submitted Visits" are both computed
  client-side from the same `GET ?action=visits` response, filtered by
  today's date and by the logged-in executive's name respectively.
- To add more executives, just add rows to the **Users** sheet — no
  redeploy needed.
- To change the color palette or fonts, edit `tailwind.config.ts`.
