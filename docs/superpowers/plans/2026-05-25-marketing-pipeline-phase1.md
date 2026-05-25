# Zesto Marketing Pipeline — Phase 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the `zesto-marketing` repo with Remotion 4, build the brand system + 2 core compositions (R3 chat demo reel + P2 quote card post), and a render script that outputs a working MP4 and PNG.

**Architecture:** Standalone TypeScript repo at `/Users/deepak/Documents/instagram/zesto-marketing/`. Remotion compositions are React components; `scripts/render.ts` calls `@remotion/renderer` programmatically (no browser needed). Content is injected via JSON prop files so templates never need code changes for new content. Higgsfield B-roll generation is included as a standalone script so the 20-clip library starts building in parallel.

**Tech Stack:** Remotion 4.0.466 · `@remotion/renderer` · `@higgsfield/client` 0.2.1 · TypeScript 5 · Vitest · tsx (for running scripts)

**Phases:**
- **Phase 1 (this plan):** Repo + brand system + 2 compositions + render script → working MP4 + PNG
- **Phase 2:** Remaining 6 reel + 2 carousel + 5 post templates
- **Phase 3:** ffmpeg stitch script (merge Higgsfield B-roll into reels)
- **Phase 4:** Playwright upload script + weekly orchestrator + cron scheduling

---

## File Map

```
zesto-marketing/
  src/
    index.ts                              # Remotion entry — calls registerRoot()
    Root.tsx                              # Registers all compositions
    components/
      BrandGradient.tsx                   # Orange→gold gradient background
      HookText.tsx                        # Bold hook overlay, fires at frame 0
      WhatsAppChat.tsx                    # Animated chat bubbles + typewriter
    compositions/
      reels/
        R3_ChatDemo.tsx                   # 20s reel: hook → WhatsApp chat flow
      posts/
        P2_QuoteCard.tsx                  # 1:1 static post: baker quote card
  scripts/
    render.ts                             # renderMedia() + renderStill() from JSON props
    generate-broll.ts                     # Higgsfield API → poll → download library
  content/
    reels/
      r3-chat-demo.json                   # Props for R3_ChatDemo
    posts/
      p2-quote-card.json                  # Props for P2_QuoteCard
  higgsfield/
    prompts.json                          # 20 B-roll scene prompts
    library/                              # Downloaded MP4s (git-ignored)
  output/
    reels/                                # Rendered MP4s (git-ignored)
    posts/                                # Rendered PNGs (git-ignored)
  tests/
    content-schema.test.ts                # Zod validation of content JSON files
    whatsapp-chat.test.ts                 # Typewriter frame logic unit tests
  package.json
  tsconfig.json
  remotion.config.ts
  .env.example
  .gitignore
```

---

### Task 1: Repo init + dependencies

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `remotion.config.ts`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Create the repo directory and init git**

```bash
mkdir /Users/deepak/Documents/instagram/zesto-marketing
cd /Users/deepak/Documents/instagram/zesto-marketing
git init
```

- [ ] **Step 2: Write package.json**

```json
{
  "name": "zesto-marketing",
  "version": "1.0.0",
  "scripts": {
    "start": "npx remotion studio src/index.ts",
    "render": "npx tsx scripts/render.ts",
    "generate-broll": "npx tsx scripts/generate-broll.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@higgsfield/client": "0.2.1",
    "@remotion/bundler": "4.0.466",
    "@remotion/cli": "4.0.466",
    "@remotion/renderer": "4.0.466",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "remotion": "4.0.466",
    "zod": "3.23.8"
  },
  "devDependencies": {
    "@types/node": "20.0.0",
    "@types/react": "18.2.0",
    "tsx": "4.11.0",
    "typescript": "5.4.5",
    "vitest": "1.6.0"
  }
}
```

- [ ] **Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "jsx": "react",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src/**/*", "scripts/**/*", "tests/**/*"]
}
```

- [ ] **Step 4: Write remotion.config.ts**

```typescript
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
```

- [ ] **Step 5: Write .gitignore**

```
node_modules/
dist/
output/
higgsfield/library/
.env
```

- [ ] **Step 6: Write .env.example**

```
HIGGSFIELD_KEY_ID=your_key_id_here
HIGGSFIELD_KEY_SECRET=your_key_secret_here
```

- [ ] **Step 7: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 8: Create output + higgsfield directories**

```bash
mkdir -p output/reels output/posts higgsfield/library content/reels content/posts tests
```

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "chore: init zesto-marketing repo with Remotion 4 + Higgsfield"
```

---

### Task 2: Brand system — BrandGradient + HookText

**Files:**
- Create: `src/components/BrandGradient.tsx`
- Create: `src/components/HookText.tsx`

- [ ] **Step 1: Write BrandGradient.tsx**

```tsx
import React from 'react';
import { AbsoluteFill } from 'remotion';

export const BrandGradient: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 50%, #ffcd3c 100%)',
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Write HookText.tsx**

```tsx
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

type Props = {
  text: string;
  subtext?: string;
};

export const HookText: React.FC<Props> = ({ text, subtext }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        opacity,
      }}
    >
      <div
        style={{
          fontSize: 72,
          fontWeight: 900,
          color: '#fff',
          textAlign: 'center',
          lineHeight: 1.1,
          textShadow: '0 2px 20px rgba(0,0,0,0.3)',
          fontFamily: 'sans-serif',
        }}
      >
        {text}
      </div>
      {subtext && (
        <div
          style={{
            fontSize: 32,
            color: 'rgba(255,255,255,0.85)',
            marginTop: 16,
            textAlign: 'center',
            fontFamily: 'sans-serif',
          }}
        >
          {subtext}
        </div>
      )}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/
git commit -m "feat: add BrandGradient and HookText components"
```

---

### Task 3: WhatsAppChat component + unit tests

**Files:**
- Create: `src/components/WhatsAppChat.tsx`
- Create: `tests/whatsapp-chat.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/whatsapp-chat.test.ts
import { describe, it, expect } from 'vitest';

// Pure logic extracted from WhatsAppChat — given a frame number and
// message startFrame, how many characters should be visible?
function visibleChars(text: string, frame: number, startFrame: number): number {
  if (frame < startFrame) return 0;
  const elapsed = frame - startFrame;
  // 10 frames to reveal full text
  const progress = Math.min(elapsed / 10, 1);
  return Math.floor(text.length * progress);
}

describe('visibleChars', () => {
  it('shows 0 chars before startFrame', () => {
    expect(visibleChars('Hello', 5, 10)).toBe(0);
  });
  it('shows all chars after full reveal', () => {
    expect(visibleChars('Hello', 25, 10)).toBe(5);
  });
  it('shows partial chars mid-reveal', () => {
    // at frame 15 (5 frames into reveal), progress = 0.5, chars = floor(5 * 0.5) = 2
    expect(visibleChars('Hello', 15, 10)).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/whatsapp-chat.test.ts
```

Expected: FAIL — `visibleChars` not defined.

- [ ] **Step 3: Write WhatsAppChat.tsx**

```tsx
import React from 'react';
import { useCurrentFrame } from 'remotion';

export type ChatMessage = {
  from: 'bot' | 'user';
  text: string;
  startFrame: number;
};

type Props = {
  messages: ChatMessage[];
  businessName: string;
};

function visibleChars(text: string, frame: number, startFrame: number): number {
  if (frame < startFrame) return 0;
  const elapsed = frame - startFrame;
  const progress = Math.min(elapsed / 10, 1);
  return Math.floor(text.length * progress);
}

const Bubble: React.FC<{ msg: ChatMessage; frame: number }> = ({ msg, frame }) => {
  const count = visibleChars(msg.text, frame, msg.startFrame);
  if (count === 0) return null;

  const isBot = msg.from === 'bot';
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isBot ? 'flex-start' : 'flex-end',
        marginBottom: 8,
      }}
    >
      <div
        style={{
          background: isBot ? '#fff' : '#dcf8c6',
          borderRadius: isBot ? '0 12px 12px 12px' : '12px 0 12px 12px',
          padding: '10px 14px',
          maxWidth: '75%',
          fontSize: 26,
          color: '#1a1a1a',
          fontFamily: 'sans-serif',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          whiteSpace: 'pre-line',
        }}
      >
        {msg.text.slice(0, count)}
      </div>
    </div>
  );
};

export const WhatsAppChat: React.FC<Props> = ({ messages, businessName }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#e5ddd5',
        borderRadius: 24,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: '#075e54',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: '#25d366',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
          }}
        >
          🎂
        </div>
        <div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, fontFamily: 'sans-serif' }}>
            {businessName}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, fontFamily: 'sans-serif' }}>
            online
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          overflowY: 'hidden',
        }}
      >
        {messages.map((msg, i) => (
          <Bubble key={i} msg={msg} frame={frame} />
        ))}
      </div>
    </div>
  );
};

export { visibleChars };
```

- [ ] **Step 4: Update test to import from component**

Replace the local `visibleChars` definition in the test file with an import:

```typescript
// tests/whatsapp-chat.test.ts
import { describe, it, expect } from 'vitest';
import { visibleChars } from '../src/components/WhatsAppChat';

describe('visibleChars', () => {
  it('shows 0 chars before startFrame', () => {
    expect(visibleChars('Hello', 5, 10)).toBe(0);
  });
  it('shows all chars after full reveal', () => {
    expect(visibleChars('Hello', 25, 10)).toBe(5);
  });
  it('shows partial chars mid-reveal', () => {
    expect(visibleChars('Hello', 15, 10)).toBe(2);
  });
});
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run tests/whatsapp-chat.test.ts
```

Expected: PASS — 3 tests passing.

- [ ] **Step 6: Commit**

```bash
git add src/components/WhatsAppChat.tsx tests/whatsapp-chat.test.ts
git commit -m "feat: add WhatsAppChat component with typewriter animation"
```

---

### Task 4: R3_ChatDemo reel composition

**Files:**
- Create: `src/compositions/reels/R3_ChatDemo.tsx`

- [ ] **Step 1: Write R3_ChatDemo.tsx**

```tsx
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { BrandGradient } from '../../components/BrandGradient';
import { HookText } from '../../components/HookText';
import { WhatsAppChat, ChatMessage } from '../../components/WhatsAppChat';

export type R3Props = {
  hookText: string;
  businessName: string;
  itemName: string;
  itemPrice: number;
};

// 0–45 frames (1.5s): hook text
// 50+ frames: WhatsApp chat animates in
const HOOK_END = 45;
const CHAT_START = 50;

export const R3_ChatDemo: React.FC<R3Props> = ({
  hookText,
  businessName,
  itemName,
  itemPrice,
}) => {
  const frame = useCurrentFrame();

  const chatOpacity = interpolate(frame, [CHAT_START, CHAT_START + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const messages: ChatMessage[] = [
    { from: 'user', text: 'Hi 👋', startFrame: CHAT_START + 5 },
    {
      from: 'bot',
      text: `Welcome to ${businessName}! 🎂\n1. Cakes\n2. Pastries\n3. Custom`,
      startFrame: CHAT_START + 25,
    },
    { from: 'user', text: '1', startFrame: CHAT_START + 65 },
    {
      from: 'bot',
      text: `1. ${itemName} – ₹${itemPrice}\n2. Chocolate Cake – ₹950`,
      startFrame: CHAT_START + 85,
    },
    { from: 'user', text: '1', startFrame: CHAT_START + 125 },
    {
      from: 'bot',
      text: `✅ Order confirmed!\n${itemName} × 1\nTotal: ₹${itemPrice}`,
      startFrame: CHAT_START + 145,
    },
  ];

  return (
    <BrandGradient>
      {/* Hook text fires first 1.5s */}
      {frame < HOOK_END && <HookText text={hookText} />}

      {/* Chat fades in after hook */}
      {frame >= CHAT_START && (
        <AbsoluteFill
          style={{
            padding: '60px 40px',
            opacity: chatOpacity,
          }}
        >
          <div
            style={{
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 24,
              overflow: 'hidden',
              height: '100%',
            }}
          >
            <WhatsAppChat messages={messages} businessName={businessName} />
          </div>
        </AbsoluteFill>
      )}
    </BrandGradient>
  );
};
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/compositions/reels/R3_ChatDemo.tsx
git commit -m "feat: add R3_ChatDemo reel composition"
```

---

### Task 5: P2_QuoteCard post composition

**Files:**
- Create: `src/compositions/posts/P2_QuoteCard.tsx`

- [ ] **Step 1: Write P2_QuoteCard.tsx**

```tsx
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { BrandGradient } from '../../components/BrandGradient';

export type P2Props = {
  quote: string;
  attribution: string;
  subtext?: string;
};

export const P2_QuoteCard: React.FC<P2Props> = ({ quote, attribution, subtext }) => {
  return (
    <BrandGradient>
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 80,
        }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 32,
            padding: '60px 50px',
            textAlign: 'center',
            width: '100%',
          }}
        >
          <div style={{ fontSize: 72, color: '#fff', marginBottom: 16 }}>❝</div>
          <div
            style={{
              fontSize: 52,
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.3,
              fontFamily: 'sans-serif',
              marginBottom: 40,
            }}
          >
            {quote}
          </div>
          <div
            style={{
              fontSize: 32,
              color: 'rgba(255,255,255,0.85)',
              fontFamily: 'sans-serif',
              fontWeight: 600,
            }}
          >
            — {attribution}
          </div>
          {subtext && (
            <div
              style={{
                fontSize: 26,
                color: 'rgba(255,255,255,0.6)',
                marginTop: 8,
                fontFamily: 'sans-serif',
              }}
            >
              {subtext}
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 40,
            fontSize: 26,
            color: 'rgba(255,255,255,0.75)',
            fontFamily: 'sans-serif',
            fontWeight: 700,
            letterSpacing: 4,
            textTransform: 'uppercase',
          }}
        >
          ZESTO
        </div>
      </AbsoluteFill>
    </BrandGradient>
  );
};
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/compositions/posts/P2_QuoteCard.tsx
git commit -m "feat: add P2_QuoteCard post composition"
```

---

### Task 6: Root.tsx + src/index.ts

**Files:**
- Create: `src/Root.tsx`
- Create: `src/index.ts`

- [ ] **Step 1: Write Root.tsx**

```tsx
import React from 'react';
import { Composition } from 'remotion';
import { R3_ChatDemo, R3Props } from './compositions/reels/R3_ChatDemo';
import { P2_QuoteCard, P2Props } from './compositions/posts/P2_QuoteCard';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="R3_ChatDemo"
        component={R3_ChatDemo}
        durationInFrames={600} // 20s at 30fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={
          {
            hookText: 'Managing bakery orders on WhatsApp DMs?',
            businessName: 'Sweet Crumbs',
            itemName: 'Red Velvet Cake',
            itemPrice: 800,
          } satisfies R3Props
        }
      />
      <Composition
        id="P2_QuoteCard"
        component={P2_QuoteCard}
        durationInFrames={1}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={
          {
            quote: 'No more missed orders. My customers love it.',
            attribution: 'Priya, Sweet Crumbs Bakery',
            subtext: 'Chennai',
          } satisfies P2Props
        }
      />
    </>
  );
};
```

- [ ] **Step 2: Write src/index.ts**

```typescript
import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

registerRoot(RemotionRoot);
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Open Remotion Studio to visually verify both compositions**

```bash
npm run start
```

Expected: browser opens at `http://localhost:3000`. Left panel shows `R3_ChatDemo` and `P2_QuoteCard`. Click `R3_ChatDemo` — scrub to frame 0 and see orange gradient + hook text. Scrub to frame 80 — see WhatsApp chat animation. Click `P2_QuoteCard` — see quote card on gradient.

- [ ] **Step 5: Commit**

```bash
git add src/Root.tsx src/index.ts
git commit -m "feat: register R3_ChatDemo and P2_QuoteCard in Remotion root"
```

---

### Task 7: Content JSON files + schema validation

**Files:**
- Create: `content/reels/r3-chat-demo.json`
- Create: `content/posts/p2-quote-card.json`
- Create: `src/schemas.ts`
- Create: `tests/content-schema.test.ts`

- [ ] **Step 1: Write src/schemas.ts**

```typescript
import { z } from 'zod';

export const R3Schema = z.object({
  hookText: z.string().min(5),
  businessName: z.string().min(1),
  itemName: z.string().min(1),
  itemPrice: z.number().positive(),
});

export const P2Schema = z.object({
  quote: z.string().min(10),
  attribution: z.string().min(1),
  subtext: z.string().optional(),
});

export type R3Content = z.infer<typeof R3Schema>;
export type P2Content = z.infer<typeof P2Schema>;
```

- [ ] **Step 2: Write the failing test**

```typescript
// tests/content-schema.test.ts
import { describe, it, expect } from 'vitest';
import { R3Schema, P2Schema } from '../src/schemas';
import r3 from '../content/reels/r3-chat-demo.json';
import p2 from '../content/posts/p2-quote-card.json';

describe('content JSON schemas', () => {
  it('r3-chat-demo.json matches R3Schema', () => {
    expect(() => R3Schema.parse(r3)).not.toThrow();
  });
  it('p2-quote-card.json matches P2Schema', () => {
    expect(() => P2Schema.parse(p2)).not.toThrow();
  });
  it('rejects R3 with missing hookText', () => {
    expect(() => R3Schema.parse({ businessName: 'x', itemName: 'y', itemPrice: 100 })).toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run tests/content-schema.test.ts
```

Expected: FAIL — JSON files not found.

- [ ] **Step 4: Write content/reels/r3-chat-demo.json**

```json
{
  "hookText": "Managing bakery orders on WhatsApp DMs?",
  "businessName": "Sweet Crumbs",
  "itemName": "Red Velvet Cake",
  "itemPrice": 800
}
```

- [ ] **Step 5: Write content/posts/p2-quote-card.json**

```json
{
  "quote": "No more missed orders. My customers love it.",
  "attribution": "Priya, Sweet Crumbs Bakery",
  "subtext": "Chennai"
}
```

- [ ] **Step 6: Add resolveJsonModule to tsconfig.json**

Add `"resolveJsonModule": true` to `compilerOptions` in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "jsx": "react",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist"
  },
  "include": ["src/**/*", "scripts/**/*", "tests/**/*"]
}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npx vitest run tests/content-schema.test.ts
```

Expected: PASS — 3 tests passing.

- [ ] **Step 8: Commit**

```bash
git add src/schemas.ts content/ tests/content-schema.test.ts tsconfig.json
git commit -m "feat: add content JSON files and Zod schema validation"
```

---

### Task 8: render.ts script

**Files:**
- Create: `scripts/render.ts`

- [ ] **Step 1: Write scripts/render.ts**

```typescript
import path from 'path';
import fs from 'fs';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { R3Schema, P2Schema } from '../src/schemas';

const ROOT = process.cwd();
const OUTPUT_REELS = path.join(ROOT, 'output', 'reels');
const OUTPUT_POSTS = path.join(ROOT, 'output', 'posts');

fs.mkdirSync(OUTPUT_REELS, { recursive: true });
fs.mkdirSync(OUTPUT_POSTS, { recursive: true });

function readContent<T>(filePath: string, parse: (v: unknown) => T): T {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return parse(raw);
}

async function main() {
  console.log('Bundling Remotion project...');
  const bundleLocation = await bundle({
    entryPoint: path.join(ROOT, 'src', 'index.ts'),
    webpackOverride: (config) => config,
  });
  console.log('Bundle complete.');

  // ── Render R3_ChatDemo reel ──────────────────────────────────────────
  const r3Props = readContent(
    path.join(ROOT, 'content', 'reels', 'r3-chat-demo.json'),
    R3Schema.parse.bind(R3Schema)
  );
  const r3Comp = await selectComposition({
    serveUrl: bundleLocation,
    id: 'R3_ChatDemo',
    inputProps: r3Props,
  });
  const r3Output = path.join(OUTPUT_REELS, 'r3-chat-demo.mp4');
  console.log('Rendering R3_ChatDemo...');
  await renderMedia({
    serveUrl: bundleLocation,
    composition: r3Comp,
    codec: 'h264',
    outputLocation: r3Output,
    inputProps: r3Props,
  });
  console.log(`✅ Reel saved: ${r3Output}`);

  // ── Render P2_QuoteCard still ────────────────────────────────────────
  const p2Props = readContent(
    path.join(ROOT, 'content', 'posts', 'p2-quote-card.json'),
    P2Schema.parse.bind(P2Schema)
  );
  const p2Comp = await selectComposition({
    serveUrl: bundleLocation,
    id: 'P2_QuoteCard',
    inputProps: p2Props,
  });
  const p2Output = path.join(OUTPUT_POSTS, 'p2-quote-card.png');
  console.log('Rendering P2_QuoteCard...');
  await renderStill({
    serveUrl: bundleLocation,
    composition: p2Comp,
    output: p2Output,
    inputProps: p2Props,
    frame: 0,
    imageFormat: 'png',
  });
  console.log(`✅ Post saved: ${p2Output}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Run the render script end-to-end**

```bash
npm run render
```

Expected output:
```
Bundling Remotion project...
Bundle complete.
Rendering R3_ChatDemo...
✅ Reel saved: /Users/deepak/Documents/instagram/zesto-marketing/output/reels/r3-chat-demo.mp4
Rendering P2_QuoteCard...
✅ Post saved: /Users/deepak/Documents/instagram/zesto-marketing/output/posts/p2-quote-card.png
```

- [ ] **Step 4: Verify the output files exist and are non-empty**

```bash
ls -lh output/reels/r3-chat-demo.mp4 output/posts/p2-quote-card.png
```

Expected: both files exist, reel is several MB, PNG is several hundred KB.

- [ ] **Step 5: Open the MP4 to visually verify**

```bash
open output/reels/r3-chat-demo.mp4
```

Expected: 20s video plays — orange gradient, hook text fades in first 1.5s, WhatsApp chat animates in, order confirmed message appears.

- [ ] **Step 6: Commit**

```bash
git add scripts/render.ts
git commit -m "feat: add render script — renderMedia for reels, renderStill for posts"
```

---

### Task 9: Higgsfield B-roll generation script

**Files:**
- Create: `higgsfield/prompts.json`
- Create: `scripts/generate-broll.ts`

- [ ] **Step 1: Write higgsfield/prompts.json**

```json
[
  { "slug": "baker-overwhelmed-01", "prompt": "South Indian bakery owner, mid-30s woman, stressed expression, looking at phone with multiple WhatsApp notifications, warm bakery lighting, shallow depth of field, cinematic 4K, 8 seconds" },
  { "slug": "baker-relieved-01", "prompt": "Same South Indian bakery owner, now calm and smiling, looking at phone with a satisfied expression, bright warm bakery light, professional, cinematic 4K, 8 seconds" },
  { "slug": "bakery-counter-01", "prompt": "Beautiful Indian bakery counter with decorated cakes and pastries, warm golden ambient lighting, nobody in frame, cinematic 4K, 8 seconds" },
  { "slug": "cake-decoration-01", "prompt": "Close-up of baker's hands decorating a birthday cake with white frosting and flowers, warm light, shallow depth of field, cinematic 4K, 8 seconds" },
  { "slug": "phone-whatsapp-01", "prompt": "Overhead shot of a smartphone on a white marble desk showing a WhatsApp conversation with a bakery, warm ambient light, cinematic 4K, 8 seconds" },
  { "slug": "bakery-storefront-01", "prompt": "Charming Indian bakery storefront exterior in the morning, golden hour light, street-level wide shot, cinematic 4K, 8 seconds" },
  { "slug": "customer-happy-01", "prompt": "Happy customer receiving a white cake box from a bakery counter, smiling, warm soft light, cinematic 4K, 8 seconds" },
  { "slug": "laptop-code-01", "prompt": "Cinematic overhead shot of a MacBook Pro with a code editor showing TypeScript code, coffee cup beside it, warm amber ambient desk lamp, bokeh background, 4K, 8 seconds" },
  { "slug": "baker-packing-01", "prompt": "Baker carefully placing a cake into a white box and tying a ribbon, warm light, close-up, cinematic 4K, 8 seconds" },
  { "slug": "bakery-display-01", "prompt": "Wide shot of a well-lit bakery display case with colourful pastries and layer cakes, nobody in frame, golden light, cinematic 4K, 8 seconds" }
]
```

- [ ] **Step 2: Write scripts/generate-broll.ts**

```typescript
import fs from 'fs';
import path from 'path';
import https from 'https';

const LIBRARY_DIR = path.join(process.cwd(), 'higgsfield', 'library');
const PROMPTS_FILE = path.join(process.cwd(), 'higgsfield', 'prompts.json');
const API_BASE = 'https://cloud.higgsfield.ai';
const BATCH_SIZE = 10;
const POLL_INTERVAL_MS = 10_000;

type Prompt = { slug: string; prompt: string };
type GenerationResult = { id: string; slug: string };

function getHeaders(): Record<string, string> {
  const keyId = process.env.HIGGSFIELD_KEY_ID;
  const keySecret = process.env.HIGGSFIELD_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error('Set HIGGSFIELD_KEY_ID and HIGGSFIELD_KEY_SECRET in .env');
  return {
    'Authorization': `Key ${keyId}:${keySecret}`,
    'Content-Type': 'application/json',
  };
}

async function apiFetch(method: string, endpoint: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Higgsfield API error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function submit(prompt: Prompt): Promise<GenerationResult> {
  const data = await apiFetch('POST', '/v1/generations', {
    prompt: prompt.prompt,
    type: 'text_to_video',
  }) as { id: string };
  return { id: data.id, slug: prompt.slug };
}

async function poll(gen: GenerationResult): Promise<string> {
  while (true) {
    const data = await apiFetch('GET', `/v1/generations/${gen.id}`) as {
      status: string;
      video_url?: string;
    };
    if (data.status === 'completed' && data.video_url) return data.video_url;
    if (data.status === 'failed') throw new Error(`Generation ${gen.id} failed`);
    console.log(`  Polling ${gen.slug} (${data.status})...`);
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(LIBRARY_DIR, { recursive: true });

  const prompts: Prompt[] = JSON.parse(fs.readFileSync(PROMPTS_FILE, 'utf-8'));
  const pending = prompts.filter(
    (p) => !fs.existsSync(path.join(LIBRARY_DIR, `${p.slug}.mp4`))
  );

  if (pending.length === 0) {
    console.log('✅ All clips already in library — nothing to generate.');
    return;
  }

  console.log(`Generating ${pending.length} clips (skipping cached)...`);

  // Process in batches of BATCH_SIZE to respect free-tier concurrency limit
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    console.log(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1}: submitting ${batch.length} clips...`);

    const generations = await Promise.all(batch.map(submit));
    console.log('Submitted. Polling for completion...');

    for (const gen of generations) {
      const videoUrl = await poll(gen);
      const dest = path.join(LIBRARY_DIR, `${gen.slug}.mp4`);
      console.log(`  Downloading ${gen.slug}...`);
      await download(videoUrl, dest);
      console.log(`  ✅ Saved: ${dest}`);
    }
  }

  console.log('\n✅ B-roll library complete.');
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Dry-run with missing env vars to verify the guard works**

```bash
npx tsx scripts/generate-broll.ts
```

Expected: `Error: Set HIGGSFIELD_KEY_ID and HIGGSFIELD_KEY_SECRET in .env`

- [ ] **Step 5: Create .env with real credentials (do NOT commit this file)**

```bash
# Create .env from the example
cp .env.example .env
# Then fill in real Higgsfield credentials from https://cloud.higgsfield.ai
```

- [ ] **Step 6: Run generate-broll with real credentials**

```bash
npx tsx scripts/generate-broll.ts
```

Expected: clips submit, poll every 10s, download to `higgsfield/library/*.mp4`. Each clip takes 1–3 minutes. With 10 clips in one batch this takes ~5 minutes total.

- [ ] **Step 7: Verify library**

```bash
ls -lh higgsfield/library/
```

Expected: 10 `.mp4` files, each 5–30 MB.

- [ ] **Step 8: Commit**

```bash
git add higgsfield/prompts.json scripts/generate-broll.ts
git commit -m "feat: add Higgsfield B-roll generation script with batch polling"
```

---

### Task 10: Final wiring + all tests green

**Files:**
- No new files — verify everything works together.

- [ ] **Step 1: Run the full test suite**

```bash
npx vitest run
```

Expected: 6 tests passing across `whatsapp-chat.test.ts` and `content-schema.test.ts`.

- [ ] **Step 2: Typecheck the whole project**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Run the render script one final time from a clean state**

```bash
rm -rf output/
npm run render
```

Expected: both `output/reels/r3-chat-demo.mp4` and `output/posts/p2-quote-card.png` created successfully.

- [ ] **Step 4: Add README.md**

```markdown
# zesto-marketing

Automated Instagram content pipeline for Zesto. Generates Reels, carousels, and posts using Remotion + Higgsfield, then uploads via Playwright.

## Phase 1 (this branch): Foundation
- BrandGradient + HookText + WhatsAppChat components
- R3_ChatDemo reel composition (20s, 9:16)
- P2_QuoteCard post composition (1:1 static)
- render.ts — produces MP4 + PNG from JSON content files
- generate-broll.ts — downloads Higgsfield B-roll library

## Quick start

\`\`\`bash
npm install
cp .env.example .env   # add Higgsfield credentials
npm run start           # Remotion Studio (visual preview)
npm run render          # produce output/reels/*.mp4 + output/posts/*.png
npm run generate-broll  # build Higgsfield library (run once)
\`\`\`

## Adding new content
Edit the JSON files in \`content/\` — no code changes needed.
\`\`\`
```

- [ ] **Step 5: Final commit**

```bash
git add README.md
git commit -m "docs: add README for Phase 1"
```

---

## Self-Review

1. **Spec coverage:**
   - ✅ `BrandGradient` — Task 2
   - ✅ `HookText` — Task 2
   - ✅ `WhatsAppChat` — Task 3
   - ✅ `R3_ChatDemo` — Task 4
   - ✅ `P2_QuoteCard` — Task 5
   - ✅ `Root.tsx` + `src/index.ts` — Task 6
   - ✅ Content JSON schema (Zod) — Task 7
   - ✅ `render.ts` — Task 8
   - ✅ `generate-broll.ts` — Task 9
   - ⏭ Remaining 6 reel + 2 carousel + 5 post templates → Phase 2
   - ⏭ ffmpeg stitch → Phase 3
   - ⏭ Playwright upload + weekly orchestrator → Phase 4

2. **Placeholder scan:** No TBDs or incomplete steps. Every code block is complete.

3. **Type consistency:**
   - `R3Props` defined in `R3_ChatDemo.tsx`, imported in `Root.tsx` ✅
   - `P2Props` defined in `P2_QuoteCard.tsx`, imported in `Root.tsx` ✅
   - `R3Schema`/`P2Schema` in `schemas.ts`, used in `render.ts` + tests ✅
   - `ChatMessage` exported from `WhatsAppChat.tsx`, used in `R3_ChatDemo.tsx` ✅
   - `visibleChars` exported from `WhatsAppChat.tsx`, tested in `whatsapp-chat.test.ts` ✅
