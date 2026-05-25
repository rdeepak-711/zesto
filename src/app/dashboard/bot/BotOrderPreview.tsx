'use client'

import { useState, useEffect, useRef } from 'react'

type Scenario = 'order' | 'track'

type Bubble = {
  dir: 'in' | 'out'
  text: string
  time: string
}

function buildScenarios(
  businessName: string,
  welcomeMsg: string,
): Record<Scenario, Bubble[]> {
  const welcome = welcomeMsg || `👋 Welcome to ${businessName}! What would you like today?`

  return {
    order: [
      { dir: 'out', text: 'Hi', time: '10:00' },
      { dir: 'in',  text: welcome, time: '10:00' },
      { dir: 'out', text: '1', time: '10:01' },
      { dir: 'in',  text: `Here are our items:\n\n1. Chocolate Truffle Cake — ₹550\n2. Red Velvet Cake — ₹600\n3. Vanilla Bean Cake — ₹450\n\nReply with a number to select.`, time: '10:01' },
      { dir: 'out', text: '1', time: '10:02' },
      { dir: 'in',  text: `How many would you like?`, time: '10:02' },
      { dir: 'out', text: '2', time: '10:03' },
      { dir: 'in',  text: `🛒 *Cart:* Chocolate Truffle Cake × 2 — ₹1,100\n\nType *confirm* to place order or keep browsing.`, time: '10:03' },
      { dir: 'out', text: 'confirm', time: '10:04' },
      { dir: 'in',  text: `🎉 Order placed! *#SC-001*\n\nTotal: ₹1,100\nWe'll notify you when it's ready. 🙏`, time: '10:04' },
    ],
    track: [
      { dir: 'out', text: 'track', time: '14:30' },
      { dir: 'in',  text: `📦 *Order #SC-001*\nStatus: ✅ Accepted\n\nChocolate Truffle Cake × 2\nTotal: ₹1,100\n\nReply *cancel order* to cancel.`, time: '14:30' },
    ],
  }
}

function formatBubbleText(text: string) {
  return text.split('\n').map((line, i, arr) => {
    const parts = line.split(/(\*[^*]+\*)/g)
    return (
      <span key={i}>
        {parts.map((part, j) =>
          part.startsWith('*') && part.endsWith('*')
            ? <strong key={j}>{part.slice(1, -1)}</strong>
            : part
        )}
        {i < arr.length - 1 && <br />}
      </span>
    )
  })
}

const SCENARIO_DELAYS: Record<Scenario, number[]> = {
  order:   [300, 900, 1700, 2700, 3600, 4500, 5400, 6400, 7400, 8300],
  track:   [400, 1200],
}

export default function BotOrderPreview({
  businessName,
  welcomeMsg,
}: {
  businessName: string
  welcomeMsg: string
}) {
  const tabs = [
    { key: 'order' as Scenario,   icon: '🛍️', label: 'Order Flow',   steps: '5 steps' },
    { key: 'track' as Scenario,   icon: '📦', label: 'Track Order',  steps: '1 step'  },
  ]

  const [scenario, setScenario] = useState<Scenario>('order')
  const [visibleCount, setVisibleCount] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const chatRef = useRef<HTMLDivElement>(null)

  const scenarios = buildScenarios(businessName, welcomeMsg)
  const bubbles = scenarios[scenario]

  function startAnimation() {
    timerRef.current.forEach(clearTimeout)
    timerRef.current = []
    setVisibleCount(0)
    SCENARIO_DELAYS[scenario].forEach((delay, i) => {
      if (i >= bubbles.length) return
      const t = setTimeout(() => {
        setVisibleCount(i + 1)
        setTimeout(() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }), 50)
      }, delay)
      timerRef.current.push(t)
    })
  }

  useEffect(() => {
    startAnimation()
    return () => timerRef.current.forEach(clearTimeout)
  }, [scenario]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <style>{`
        .phone-shell { background:#1a1a1a; border-radius:44px; padding:10px;
          box-shadow:0 0 0 1px rgba(255,255,255,.07),0 40px 80px rgba(0,0,0,.4),0 16px 32px rgba(0,0,0,.2),inset 0 0 0 1px rgba(255,255,255,.04); }
        .phone-inner { border-radius:36px; overflow:hidden; height:560px; display:flex; flex-direction:column; background:#efeae2; position:relative; }
        .wa-header-bar { background:#075E54; padding:34px 12px 10px; display:flex; align-items:center; gap:10px; flex-shrink:0; }
        .wa-chat-area { flex:1; overflow-y:auto; padding:10px 10px 6px; display:flex; flex-direction:column; gap:4px; scrollbar-width:none; }
        .wa-chat-area::-webkit-scrollbar { display:none; }
        .bubble-out { background:#dcf8c6; border-radius:10px 10px 3px 10px; position:relative; }
        .bubble-in  { background:#fff; border-radius:10px 10px 10px 3px; position:relative; box-shadow:0 1px 2px rgba(0,0,0,.1); }
        .bubble-out::after { content:''; position:absolute; bottom:0; right:-7px; border:7px solid transparent; border-bottom-color:#dcf8c6; border-right:0; }
        .bubble-in::after  { content:''; position:absolute; bottom:0; left:-7px; border:7px solid transparent; border-bottom-color:#fff; border-left:0; }
        @keyframes bubbleSlide { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .bubble-appear { animation:bubbleSlide .25s ease forwards; }
        @keyframes bounceDot { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-4px)} }
        .typing-dot { animation:bounceDot 1.1s infinite ease; }
        .typing-dot:nth-child(2) { animation-delay:.18s; }
        .typing-dot:nth-child(3) { animation-delay:.36s; }
        @keyframes pulseGreen { 0%,100%{opacity:1} 50%{opacity:.35} }
        .pulse-green { animation:pulseGreen 2s infinite; }
      `}</style>

      <div className="flex flex-col items-center gap-4 w-full">
        <div className="flex w-full items-center justify-between">
          <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Live Preview</span>
          <button onClick={startAnimation} className="text-[10px] font-semibold text-orange-500 hover:text-orange-600 transition-colors">
            ↺ Replay
          </button>
        </div>

        <div className="flex w-full bg-gray-100 rounded-xl p-1 gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setScenario(t.key)}
              className={`flex-1 flex flex-col items-center py-2 px-1 rounded-lg text-center transition-all ${scenario === t.key ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
            >
              <span className="text-base leading-none">{t.icon}</span>
              <span className={`text-[10px] font-bold mt-1 leading-none ${scenario === t.key ? 'text-gray-900' : 'text-gray-500'}`}>{t.label}</span>
              <span className={`text-[9px] mt-0.5 leading-none ${scenario === t.key ? 'text-orange-500 font-semibold' : 'text-gray-400'}`}>{t.steps}</span>
            </button>
          ))}
        </div>

        <div className="phone-shell w-[280px] flex-shrink-0">
          <div className="phone-inner">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-7 bg-[#1a1a1a] rounded-b-2xl z-20" />
            <div className="wa-header-bar">
              <span className="text-white/70 text-lg">‹</span>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {businessName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-[13px] font-semibold truncate">{businessName}</div>
                <div className="text-white/60 text-[10px] mt-px flex items-center gap-1">
                  <span className="pulse-green w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  online
                </div>
              </div>
              <div className="flex gap-3 text-white/70 text-base"><span>📹</span><span>📞</span></div>
            </div>

            <div className="wa-chat-area" ref={chatRef}>
              <div className="self-center text-[10px] text-gray-600 bg-white/70 rounded-md px-2 py-0.5 font-mono mb-1">Today</div>
              {bubbles.map((b, i) => {
                if (i >= visibleCount) return null
                const isLast = i === visibleCount - 1
                const nextIsIn = i + 1 < bubbles.length && bubbles[i + 1].dir === 'in'
                const showTyping = isLast && b.dir === 'out' && nextIsIn && visibleCount < bubbles.length
                return (
                  <div key={`${scenario}-${i}`}>
                    <div className={`flex bubble-appear ${b.dir === 'out' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[82%] px-2.5 py-1.5 font-mono text-[10.5px] leading-[1.55] ${b.dir === 'out' ? 'bubble-out' : 'bubble-in'}`}>
                        {formatBubbleText(b.text)}
                        <div className={`flex items-center justify-end gap-1 mt-0.5 text-[9px] ${b.dir === 'out' ? 'text-[#7eb67e]' : 'text-gray-400'}`}>
                          {b.time}{b.dir === 'out' && <span className="text-[#53bdeb]">✓✓</span>}
                        </div>
                      </div>
                    </div>
                    {showTyping && (
                      <div className="flex justify-start mt-1 bubble-appear">
                        <div className="bubble-in px-3 py-2 flex items-center gap-1">
                          <span className="typing-dot w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
                          <span className="typing-dot w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
                          <span className="typing-dot w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="bg-[#efeae2] px-2 py-1.5 flex items-center gap-1.5 flex-shrink-0">
              <span className="text-gray-400 text-xl">☺</span>
              <div className="flex-1 bg-white rounded-full px-3 py-1.5 text-[10px] font-mono text-gray-400">Type a message</div>
              <span className="text-gray-400 text-base">📎</span>
              <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center text-white text-sm flex-shrink-0">🎤</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
