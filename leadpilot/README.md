# LeadPilot AI

A white-label **AI receptionist** you sell to local businesses for a monthly fee. One line of code puts a chat widget on any website. Powered by AI (free Groq/Gemini models to start, Claude when you're ready), it answers visitors' questions from the business's own info, guides them to book, and **captures their name/phone/email as leads**.

**Read [PLAYBOOK.md](PLAYBOOK.md) for how to sell it.** The code is the easy half.

## What's included

| URL | What it is | Who uses it |
|---|---|---|
| `/` | Sales landing page with pricing, FAQ and a demo-request form | Your prospects |
| `/admin` | Create a bot per client (with **one-click import from their website**), track prospects and follow-ups, see MRR and leads, and generate monthly client reports | You |
| `/demo/<botId>` | Live demo page for one bot (add `?site=https://their-site.com` to show their site behind it) | Prospects you're pitching |
| `/portal/<secret>` | Private, read-only lead dashboard + CSV export | Each paying client |
| `/widget.js` | The embeddable chat widget (style-isolated, mobile-friendly) | Your clients' website visitors |

Features: per-client knowledge, tone, goal, booking link and brand color · AI lead capture via tool use · webhook per client (Zapier/Make/CRM) · monthly message caps per plan · per-IP rate limiting · "Powered by" badge on the Starter plan · Stripe Payment Links on pricing buttons · your own bot on your landing page.

## Run it locally (2 minutes)

```bash
cd leadpilot
cp .env.example .env        # set ADMIN_PASSWORD (+ a free GROQ_API_KEY for real AI)
npm install
npm start                   # http://localhost:3000, admin at /admin
```

Requires Node.js 22.5+ (it uses the built-in `node:sqlite`, so there's no database to install).

## AI engine: start free, upgrade later

| Mode | Cost | Setup | Quality |
|---|---|---|---|
| **Demo mode** (default, no key) | $0 | nothing | Keyword matching on the business info. Fine for showing prospects, not for live clients |
| **Groq** (`GROQ_API_KEY`) | Free tier | 2-min signup at console.groq.com | Good: real AI (Llama 3.3 70B), very fast |
| **Google Gemini** (`GEMINI_API_KEY`) | Free tier | Google account at aistudio.google.com | Good |
| **OpenRouter** (`OPENROUTER_API_KEY`) | Free `:free` models | openrouter.ai | Varies by model |
| **Ollama** (`AI_PROVIDER=ollama`) | Free, runs on your machine | Install Ollama | Depends on your hardware |
| **Claude** (`ANTHROPIC_API_KEY`) | Paid per message | console.anthropic.com | Best. Switch once clients are paying |

The app picks whichever key it finds (Claude → Groq → Gemini → OpenRouter → demo). The admin dashboard shows which engine is active. Leads are captured server-side too, so even a model that forgets to call the lead tool won't lose a lead.

Free tiers have rate limits and their terms can change. Check the provider's limits before putting many clients on one free key.

## Deploy (pick one)

Any host that runs Node and gives you a **persistent disk** for `DATA_DIR`:

- **Railway / Render**: New service from this repo, root directory `leadpilot`, start command `npm start`, add a volume mounted at `/data` and set `DATA_DIR=/data`, then set the env vars from `.env.example`.
- **A $5 VPS** (Hetzner, DigitalOcean): `git clone`, `npm install`, run with `pm2 start npm -- start`, put Caddy or Nginx in front for HTTPS.

Set `PUBLIC_URL` to your real domain, because the embed codes and demo links use it.

## Daily workflow

0. **Prospects** tab → add a business you want to pitch → **Create demo bot** gives you a demo link plus a ready-to-send outreach message. Set a follow-up date; due follow-ups show in red.
1. `/admin` → **+ New client bot** → **Import from website** (or paste the business info), then review it.
2. **Install / share** gives you three things: the embed code for their site, the demo link to pitch with, and their private portal link.
3. Leads show up in the admin, in their portal, and (optionally) at their webhook.
4. Each month, click **Report** on a client for a ready-to-copy email showing their conversations and leads. This is what keeps them paying.

## Tests

`npm test` runs the test suite (Node's built-in runner, no extra dependencies). GitHub Actions runs it on every change to `leadpilot/`.

## Configuration

See `.env.example`. Notable settings:

- `AI_PROVIDER` / `AI_MODEL`: choose the engine and model (see the table above). With Claude the default is `claude-opus-5-5`; `claude-haiku-5-5` costs much less per message.
- `LEADPILOT_EFFORT`: Claude only, `low` by default for fast chat replies.
- On Claude, refusal fallback is enabled server-side (`fallbacks: "default"`).

## Project layout

```
leadpilot/
  src/server.js   Express app: widget API, admin API, portal, pages
  src/ai.js       picks the AI provider; server-side lead-capture safety net
  src/prompt.js   shared system prompt + lead tool definition
  src/providers/  anthropic.js (Claude), openai-compatible.js (Groq/Gemini/OpenRouter/Ollama), demo.js (no key)
  src/leadExtract.js  pulls name/phone/email out of visitor messages
  src/db.js       SQLite schema and queries (bots, leads, usage, inquiries)
  public/         landing, admin, demo, portal pages + widget.js
```

## Production notes

- Back up `DATA_DIR/leadpilot.db` (a daily copy is enough).
- The rate limiter is in-memory. That's fine for one server; use Redis if you scale out.
- Use a long `ADMIN_PASSWORD`. The admin API is protected by it.
