# Writer's Cube V0.5 — Local Setup

## Prerequisites

- Node.js 22+ (we installed 26 via `brew install node`)
- pnpm (installed via `npm install -g pnpm`)

## 1. Install dependencies

```bash
pnpm install
```

## 2. Environment variables

`.env.local` is already populated with the live Supabase project values for `writers-cube-v05`. If you ever rotate keys, grab fresh values from the Supabase dashboard → Project Settings → API.

## 3. Google OAuth (manual — one-time)

This is the only step a human has to do. Approx. 10 minutes.

### 3a. Create a Google OAuth client

1. Go to <https://console.cloud.google.com/apis/credentials>
2. Create a new project named `Writers Cube` (or reuse an existing one).
3. **OAuth consent screen** → "External" → fill in app name, your email, support email. Add scopes: `email`, `profile`, `openid`. Add yourself as a test user.
4. **Credentials** → "Create credentials" → "OAuth client ID" → "Web application".
5. **Authorized JavaScript origins**:
   - `http://localhost:3000`
6. **Authorized redirect URIs**:
   - `https://rjnfvyjghybutgrtbbeu.supabase.co/auth/v1/callback`
7. Save the **Client ID** and **Client secret**.

> **Never commit the Client Secret to this repo.** It belongs only in the Supabase dashboard (next step). The Client ID is technically public but we keep it out of the repo too for tidiness.

### 3b. Wire it into Supabase

1. Go to <https://supabase.com/dashboard/project/rjnfvyjghybutgrtbbeu/auth/providers>
2. Enable the **Google** provider.
3. Paste in the Client ID + Client secret from step 3a.
4. Click Save.

### 3c. Set the Site URL

In Supabase dashboard → Auth → URL Configuration:
- **Site URL**: `http://localhost:3000`
- **Redirect URLs** (add): `http://localhost:3000/auth/callback`

(When we deploy to Vercel, we'll add the preview/prod URLs here too.)

## 4. Run

```bash
pnpm dev
```

Open <http://localhost:3000>, click "Sign in with Google" — you should land on `/app` and be able to create chapters/scenes.

## 5. Database

The schema lives in `supabase/migrations/0001_init_writing_schema.sql` and is already applied to the remote project. To re-apply on a fresh project, paste the SQL into the Supabase SQL editor or use the Supabase CLI.
