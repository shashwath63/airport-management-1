# LeadPilot AI: the money playbook

You're not selling "a chatbot." You're selling **"you stop losing customers who visit your website at night."**
Business owners don't buy AI. They buy more booked appointments.

---

## 1. The offer

| | Price | What they get |
|---|---|---|
| Setup | $297 one-time (waive it to close faster) | You train the bot on their business and install it |
| Starter | $97/mo | 1,000 messages, lead dashboard, "Powered by" badge |
| **Growth** | **$197/mo** | 4,000 messages, Zapier/CRM/SMS alerts, no badge, monthly tune-up |
| Pro | $397/mo | 15,000 messages, multi-location, quarterly call |

**Why they'll pay:** if a dental clinic gets *one* extra new patient per month from the bot, that's $500–$2,000 of lifetime value, against $197.
Always frame the price against one extra customer.

## 2. Who to sell to (pick ONE niche first)

Best niches have **high customer value + lots of after-hours website traffic + questions before buying**:

1. **Dentists / orthodontists**: new patient ≈ $1k+ LTV
2. **Med spas / aesthetics / cosmetic clinics**: lots of price questions
3. **Home services**: roofers, HVAC, plumbers, solar (jobs worth $5k–$20k)
4. **Law firms**: personal injury, immigration, family law
5. **Real estate agents / property managers**
6. **Gyms, yoga studios, martial arts**: trial-class bookings
7. **Driving schools, tutoring centers, coaching institutes**

Picking one niche lets you reuse the same knowledge template, the same pitch and the same case study. You'll get really good, really fast.

## 3. Your unfair advantage: the "already built it" demo

Never ask "do you want a chatbot?" Instead:

1. Find a business's website (Google Maps: "dentist in <city>").
2. Copy their website text → paste into Claude: *"Turn this into a clean FAQ + services/prices/hours sheet for a receptionist."*
3. In `/admin` → **New client bot** → paste it. Takes ~5 minutes.
4. Send them the **demo link** (`/demo/<id>?site=<their-website>`). They chat with *their own* AI receptionist that already knows *their* prices and hours.

This converts dramatically better than any pitch, because they see it working on their own business.

## 4. Outreach scripts (copy, personalize, send)

**Cold email / LinkedIn / Instagram DM**
> Subject: built something for {{Business}}
>
> Hi {{Name}}, I noticed {{Business}}'s website doesn't have a way to answer questions after hours, so people visiting at night probably just leave.
>
> I built you a free AI receptionist trained on your services, prices and hours. Try it here (takes 30 seconds): {{demo_link}}
>
> If you like it, I can have it live on your site in 48 hours. If not, no worries, it's yours to play with.
>
> {{Your name}}

**Follow-up (3 days later)**
> Hi {{Name}}, did you get a chance to try the assistant? I asked it "{{a real question, e.g. do you take Delta Dental?}}" and it answered correctly and asked for my number. Happy to turn it on for a free 14-day trial.

**Walk-in / phone (local businesses love this)**
> "Hi, I help {{niche}} businesses capture the customers who visit their website after hours. I actually already built one for you, can I show you on my phone? It takes 30 seconds."

**Volume target:** 20 personalized demos/day → expect ~1–3 replies → ~1 client/week early on. It compounds.

## 5. Closing & onboarding

- Offer a **14-day free trial** → install it → show them leads in their **private portal link**. Leads in the dashboard sell the subscription for you.
- Get paid with **Stripe Payment Links** (no code: dashboard.stripe.com → Payment Links → create a monthly subscription for each plan). Put the links in `.env` and they appear on your pricing buttons.
- Install: send them the embed code, or ask for website access and do it yourself (WordPress: "Insert Headers and Footers" plugin; Wix: Settings → Custom Code; Shopify: theme.liquid; Squarespace: Code Injection).
- Leads to their phone: create a free Zapier "Catch Hook" → paste the URL in the bot's **webhook** field → Zap to Gmail / SMS / their CRM.

## 6. Unit economics (rough, verify in your provider's console)

**Start at $0:** run on a free Groq or Gemini key while you land your first clients. Move to Claude when revenue covers it. It's one line in `.env`.


A chat message is roughly 2–4k input tokens (business info + conversation) plus a few hundred output tokens.

| Model (`LEADPILOT_MODEL`) | ≈ cost per 1,000 messages | Margin on Starter ($97) |
|---|---|---|
| `claude-opus-5-5` (default, smartest) | ~$10–25 | ~75–90% |
| `claude-haiku-5-5` (cheapest) | under $1 | ~99% |

Prompt caching is already on, which cuts repeat input cost a lot. Hosting is ~$5–10/mo for *all* clients combined.
Start on Opus for best quality. Once you have many clients, test Haiku on a few and compare.

**Revenue math:** 10 clients × $197 = **$1,970/mo**. 30 clients = **~$5,900/mo** (~$71k/yr), and it's almost all margin.

## 7. 30-day launch plan

| Week | Do this |
|---|---|
| 1 | Deploy (see README). Pick a niche. Buy a domain. Set `BRAND_NAME`. Make a bot for your own site (`HOUSE_BOT_ID`). Build 3 demo bots for real local businesses. |
| 2 | Send 20 demo links/day. Offer the first 3 clients free setup + 50% off month one in exchange for a testimonial. |
| 3 | Install for first clients. Screenshot their portal with real leads → that's your case study. |
| 4 | Put the case study on your landing page and in every outreach message. Raise prices for new clients. |

## 8. Upsells once they trust you

- **Monthly tune-up** (review conversations, improve answers): included in Growth, or $49/mo
- **Google Review requests / reactivation SMS campaigns** to their lead list
- **More AI automations**: missed-call text-back, appointment reminders, AI-written social posts
- **Website rebuilds** for clients with outdated sites ($1–3k one-time)

## 9. Rules that keep clients paying

1. Never let the bot invent facts. Keep each client's knowledge box accurate and updated.
2. Send each client a monthly 3-line email: *"Your assistant handled X conversations and captured Y leads this month."* (numbers are in your admin + their portal).
3. Respond to issues within a day. Small businesses churn when they feel ignored, not over price.
4. Be upfront that it's an AI assistant. Don't present it as a human.
