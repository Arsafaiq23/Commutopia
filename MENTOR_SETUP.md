# GPT Transit Mentor

Commutopia uses AI only as an educational layer. The transit graph remains the authority for routes, challenge validation, score, and unlocks.

## Local

1. Copy `.env.example` to `.env`.
2. Set `OPENAI_API_KEY` to a project API key and optionally set `OPENAI_MODEL`.
3. Restart the Vite server: `npm run dev -- --host 127.0.0.1`.

The app calls `/api/mentor`; Vite keeps the API key server-side. Never use a `VITE_OPENAI_API_KEY` variable.

## Production

The included `api/mentor.ts` is a Vercel serverless endpoint. In the Vercel project settings, set:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional; defaults to `gpt-5-mini`)

The client has a short timeout and always falls back to grounded, deterministic mentor copy if the API is unavailable or returns malformed JSON.

## Mentor limits

- It receives only graph facts and aggregated learning signals.
- It may explain, coach, recommend an existing practice, and describe a selected station.
- It must not route, validate a challenge, invent a connection, or give real-time travel advice.
