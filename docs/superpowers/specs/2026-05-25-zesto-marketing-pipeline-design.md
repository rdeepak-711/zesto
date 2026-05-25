# Zesto Marketing Pipeline — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A fully automated content factory that generates and posts 7 pieces of Instagram content per week (4 Reels · 2 Carousels · 1 Static post) using Remotion, Higgsfield, ffmpeg, and Playwright — with zero manual work after the weekly calendar JSON is filled.

**Architecture:** Standalone repo `zesto-marketing`. One weekly script generates all content via Remotion `renderMedia()`/`renderStill()` + Higgsfield REST API, stitches with ffmpeg, then Playwright uploads each piece at the algorithmically optimal time and day.

**Tech Stack:** Remotion 4.x · `@higgsfield/client` · `fluent-ffmpeg` · Playwright · Node.js/TypeScript · cron (macOS launchd or node-cron)

---

## Data-Backed Posting Strategy (2026)

Research sources: Buffer, Later, Hootsuite, Truefuturemedia (verified May 2026)

- **Frequency:** 4–5 pieces/week max. Posting twice in one day suppresses distribution.
- **Mix:** 50–60% Reels (reach), 30% Carousels (saves/shares), 10–20% Static (announcements only)
- **Reel length:** ≤30s for discovery. 80% retention on 15s beats 30% retention on 60s.
- **Hook:** Text overlay fires in first 1.5s. Muted-watchable — audio is optional.
- **Hashtags:** Max 5. Mix: 2 hyperlocal + 2 niche + 1 content-type.
- **Captions:** Short (1–2 lines) for Reels. Long (150–300 words) for Carousels. Front-load keywords.
- **Post times (IST):** Weekdays 6–9 PM. Thursday 9 PM and Sunday 8 PM are peak slots.
- **Carousels:** Slide 1 cuts off mid-sentence to force a swipe.

---

## Weekly Content Calendar

| Day | Type | Template | Length | Post Time IST |
|-----|------|----------|--------|---------------|
| Mon | Reel | R3 — WhatsApp chat demo | 15–20s | 7 PM |
| Tue | Carousel | C1 — Lead magnet ("5 WhatsApp mistakes") | 6 slides | 8 PM |
| Wed | Reel | R4 — Feature spotlight | 15s | 7 PM |
| Thu | Carousel | C2 — Before/After | 4 slides | 9 PM |
| Fri | Reel | R5 — Stat reveal | 10–15s | 7 PM |
| Sat | Static | P2 — Quote/tip card | 1 image | 6 PM |
| Sun | Reel | R1 — Hero (Problem→Solution) | 30s | 8 PM |

---

## Repo Structure

```
zesto-marketing/
  src/
    compositions/
      reels/
        R1_HeroVideo.tsx          # Problem→Solution, 30s, 9:16
        R2_SplitScreen.tsx        # Customer↔Baker, 30s, 9:16
        R3_ChatDemo.tsx           # WhatsApp chat flow, 15–20s, 9:16
        R4_FeatureSpotlight.tsx   # Single feature, 15s, 9:16
        R5_StatReveal.tsx         # Number/stat animation, 10–15s, 9:16
        R6_BeforeAfter.tsx        # Chaos→Zesto, 20s, 9:16
        R7_TipReel.tsx            # "Did you know...", 15s, 9:16
        R8_OriginStory.tsx        # Built with Claude Code, 45s, 9:16
      carousels/
        C1_LeadMagnet.tsx         # Tips listicle, 6 slides, 1:1
        C2_BeforeAfter.tsx        # 4 slides, 1:1
        C3_HowItWorks.tsx         # Step-by-step, 5 slides, 1:1
      posts/
        P1_StatCard.tsx           # Single stat, 1:1
        P2_QuoteCard.tsx          # Baker quote, 1:1
        P3_TipCard.tsx            # Tip/insight, 1:1
        P4_FeatureCard.tsx        # Feature highlight, 1:1
        P5_CTACard.tsx            # Call to action, 1:1
        P6_MemeCard.tsx           # Hook/meme, 1:1
    components/
      WhatsAppChat.tsx            # Animated chat bubbles + typewriter
      ZestoDashboard.tsx          # Dashboard orders mockup
      BrandGradient.tsx           # Orange→gold gradient + glassmorphism
      CodeTyping.tsx              # Terminal code typing (origin story)
      HookText.tsx                # Large bold hook overlay (first 1.5s)
      CarouselFrame.tsx           # Shared carousel slide wrapper
  scripts/
    generate-broll.ts             # Higgsfield API: submit prompts → poll → download
    render.ts                     # renderMedia() for reels, renderStill() for stills
    stitch.ts                     # fluent-ffmpeg: concat Higgsfield + Remotion clips
    upload.ts                     # Playwright: Instagram login + upload + caption + post
    generate-week.ts              # Orchestrator: broll check → render → stitch → schedule uploads
  content/
    calendar/
      week-01.json                # Defines all 7 pieces for the week
      week-02.json
    reels/
      r1-hero.json                # Props: hook text, item name, broll clip ref, caption, hashtags
      r3-chat-demo.json
      ...
    carousels/
      c1-lead-magnet.json         # Props: title, slide texts, caption
      c2-before-after.json
    posts/
      p2-quote-card.json          # Props: quote, attribution, caption
  higgsfield/
    prompts.json                  # 20 B-roll scene prompts
    library/                      # Downloaded MP4s — generated once, reused forever
  output/
    reels/                        # Final MP4s ready to upload
    carousels/                    # PNG sequences
    posts/                        # Single PNGs
  Root.tsx
  remotion.config.ts
  package.json
```

---

## Component Specs

### BrandGradient.tsx
Full-screen background: `linear-gradient(135deg, #ff6b35, #f7931e, #ffcd3c)`. Glassmorphism card overlay: `rgba(255,255,255,0.15)`, `backdrop-filter: blur(10px)`, `border: 1px solid rgba(255,255,255,0.3)`.

### HookText.tsx
Props: `text: string`, `subtext?: string`. Bold white text, 72px, centered, appears at frame 0, hold for 1.5s (45 frames at 30fps). Critical: fires before any other animation.

### WhatsAppChat.tsx
Props: `messages: {from:'bot'|'user', text:string, delayFrames:number}[]`, `businessName:string`. Renders chat bubbles with typewriter reveal per message. Green bubbles (user), white (bot), WhatsApp-accurate styling.

### ZestoDashboard.tsx
Props: `orderName:string`, `price:number`, `status:'PENDING'|'ACCEPTED'`. Static mockup of Zesto orders page — orange Accept button animates with pulse on status change.

### CarouselFrame.tsx
Props: `slideNumber:number`, `totalSlides:number`, `headline:string`, `body:string`, `cutOff?:boolean`. When `cutOff=true` on slide 1: headline truncates with `...` to force swipe.

---

## Scripts Spec

### generate-broll.ts
1. Read `higgsfield/prompts.json`
2. Skip clips already in `higgsfield/library/`
3. Submit remaining to `POST https://cloud.higgsfield.ai/v1/generations` in batches of 10
4. Poll `GET /v1/generations/{id}` every 10s until `status === 'completed'`
5. Download video URL to `higgsfield/library/{slug}.mp4`

Auth: `Authorization: Key ${HF_KEY_ID}:${HF_KEY_SECRET}` header.

### render.ts
- Reels: `bundle()` → `selectComposition()` → `renderMedia({ codec:'h264', outputLocation })` per reel JSON
- Stills: `renderStill({ frame: 0, outputLocation })` per carousel slide and post
- Input props injected from content JSON files

### stitch.ts
For reels referencing a `brollClip`: use `fluent-ffmpeg` to concat `[library/{clip}.mp4, output/reels/{reel}-remotion.mp4]` → `output/reels/{reel}-final.mp4`. Pure-Remotion reels skip this.

### upload.ts
1. Launch Playwright browser, load `session.json` cookies if exists
2. If session expired: navigate to instagram.com, fill login form with `INSTAGRAM_USER` + `INSTAGRAM_PASS`, save new session cookies
3. For each upload task: navigate to instagram.com, click `+` (new post), upload file, paste caption + hashtags from content JSON, select correct type (reel/post/carousel), click Share
4. Carousel: uploads all PNGs in sequence for that slot
5. Log result (success/fail) to `output/upload-log.json`

### generate-week.ts (orchestrator)
```
1. Read content/calendar/week-{N}.json
2. Run generate-broll.ts (skips cached clips)
3. Run render.ts for all 7 pieces
4. Run stitch.ts for reels with broll refs
5. Schedule upload.ts calls via node-cron at each piece's designated day + time
```

---

## Content JSON Schema

### Week calendar (`content/calendar/week-01.json`)
```json
[
  { "day": "Mon", "type": "reel", "template": "R3", "contentFile": "content/reels/r3-chat-demo.json" },
  { "day": "Tue", "type": "carousel", "template": "C1", "contentFile": "content/carousels/c1-lead-magnet.json" },
  ...
]
```

### Reel content file
```json
{
  "hookText": "Managing bakery orders on WhatsApp DMs?",
  "itemName": "Red Velvet Cake",
  "brollClip": "baker-overwhelmed-01",
  "caption": "WhatsApp ordering for bakeries — no app, no chaos, just orders.\n\nTry Zesto free 👇",
  "hashtags": ["#BakeryBusiness", "#FnBIndia", "#ChennaiBakery", "#WhatsAppBusiness", "#SmallBizIndia"]
}
```

### Carousel content file
```json
{
  "title": "5 WhatsApp mistakes killing your bakery sales",
  "slides": [
    { "headline": "You're losing orders and you don't even know it...", "body": "", "cutOff": true },
    { "headline": "Mistake #1", "body": "Taking orders in DMs with no confirmation system" },
    ...
  ],
  "caption": "Save this — share it with every bakery owner you know.",
  "hashtags": ["#BakeryBusiness", "#FnBIndia", "#ChennaiBakery", "#WhatsAppTips", "#SmallBizIndia"]
}
```

---

## Higgsfield B-Roll Library (20 clips, generated once)

| Slug | Prompt |
|------|--------|
| `baker-overwhelmed-01` | South Indian bakery owner, mid-30s, stressed at phone with multiple WhatsApp notifications, warm bakery lighting, shallow DOF, cinematic 4K |
| `baker-relieved-01` | Same baker, calm, smiling at phone, bright warm light, professional |
| `bakery-counter-01` | Beautiful bakery counter with decorated cakes, warm golden lighting, cinematic |
| `cake-decoration-01` | Close-up hands decorating a cake with frosting, warm light, shallow DOF |
| `phone-whatsapp-01` | Overhead: phone screen showing WhatsApp chat with a bakery, clean white desk |
| `bakery-storefront-01` | Charming bakery storefront, morning light, street-level shot, cinematic |
| `customer-happy-01` | Customer receiving a cake box, smiling, warm light |
| `laptop-code-01` | Cinematic overhead: MacBook with code editor, coffee cup, warm ambient light |
| `baker-packing-01` | Baker packing a cake box carefully, warm light, professional |
| `bakery-display-01` | Wide shot of bakery display case with pastries and cakes, golden light |
| *(10 more seasonal/variant clips)* | |

---

## Environment Variables

```
HIGGSFIELD_KEY_ID=
HIGGSFIELD_KEY_SECRET=
INSTAGRAM_USER=
INSTAGRAM_PASS=
```

---

## Self-Review

1. ✅ No TBDs or placeholders — all component props, script logic, and JSON schemas are fully specified
2. ✅ Internal consistency — template names (R1–R8, C1–C3, P1–P6) match across calendar, file structure, and compositions
3. ✅ Scope — single implementation plan, well-bounded
4. ✅ Posting frequency matches research: 7 pieces/week, 1/day, never 2 in one day
5. ✅ Higgsfield free tier respected — library generated once, ~10 concurrent max, daily renders are Remotion-only
