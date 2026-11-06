# LeadPilot AI

A white-label **AI receptionist** you sell to local businesses for a monthly fee. One line of code puts a chat widget on any website. Powered by Claude, it answers visitors' questions from the business's own info, guides them to book, and **captures their name/phone/email as leads**.

**Read [PLAYBOOK.md](PLAYBOOK.md) for how to sell it.** The code is the easy half.

## What's included

| URL | What it is | Who uses it |
|---|---|---|
| `/` | Sales landing page with pricing, FAQ and a demo-request form | Your prospects |
| `/admin` | Create a bot per client, see MRR, leads and inquiries | You |
| `/demo/<botId>` | Live demo page for one bot (add `?site=https://their-site.com` to show their site behind it) | Prospects you're pitching |
| `/portal/<secret>` | Private, read-only lead dashboard + CSV export | Each paying client |
| `/widget.js` | The embeddable chat widget (style-isolated, mobile-friendly) | Your clients' website visitors |

Features: per-client knowledge, tone, goal, booking link and brand color · AI lead capture via tool use · webhook per client (Zapier/Make/CRM) · monthly message caps per plan · per-IP rate limiting · "Powered by" badge on the Starter plan · Stripe Payment Links on pricing buttons · your own bot on your landing page.

## Run it locally (2 minutes)

```bash
cd leadpilot
cp .env.example .env        # set ANTHROPIC_API_KEY and ADMIN_PASSWORD
npm install
npm start                   # http://localhost:3000, admin at /admin
```

Requires Node.js 22.5+ (it uses the built-in `node:sqlite`, so there's no database to install).

## Deploy (pick one)

Any host that runs Node and gives you a **persistent disk** for `DATA_DIR`:

- **Railway / Render**: New service from this repo, root directory `leadpilot`, start command `npm start`, add a volume mounted at `/data` and set `DATA_DIR=/data`, then set the env vars from `.env.example`.
- **A $5 VPS** (Hetzner, DigitalOcean): `git clone`, `npm install`, run with `pm2 start npm -- start`, put Caddy or Nginx in front for HTTPS.

Set `PUBLIC_URL` to your real domain, because the embed codes and demo links use it.

## Daily workflow

1. `/admin` → **+ New client bot** → paste the business info (services, prices, hours, FAQs).
2. **Install / share** gives you three things: the embed code for their site, the demo link to pitch with, and their private portal link.
3. Leads show up in the admin, in their portal, and (optionally) at their webhook.

## Configuration

See `.env.example`. Notable settings:

- `LEADPILOT_MODEL`: defaults to `claude-opus-5-5`. Set `claude-haiku-5-5` for much lower cost per message.
- `LEADPILOT_EFFORT`: `low` by default for fast chat replies.
- Refusal fallback is enabled server-side (`fallbacks: "default"`), so a declined request is retried automatically on a suitable model.

## Project layout

```
leadpilot/
  src/server.js   Express app: widget API, admin API, portal, pages
  src/ai.js       Claude integration: system prompt + capture_lead tool loop
  src/db.js       SQLite schema and queries (bots, leads, usage, inquiries)
  public/         landing, admin, demo, portal pages + widget.js
```

## Production notes

- Back up `DATA_DIR/leadpilot.db` (a daily copy is enough).
- The rate limiter is in-memory. That's fine for one server; use Redis if you scale out.
- Use a long `ADMIN_PASSWORD`. The admin API is protected by it.
