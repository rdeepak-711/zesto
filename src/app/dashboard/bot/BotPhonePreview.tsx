'use client'

import { useState, useEffect, useRef } from 'react'

type Scenario = 'frame' | 'other'

type Bubble = {
  dir: 'in' | 'out'
  text: string
}

function buildScenarios(messages: Record<string, string>, businessName: string, pricingSample: string) {
  const welcome = (messages['welcome'] ?? `👋 Welcome to ${businessName}! What are you looking for today?`)
    .replace('{businessName}', businessName)
    .replace(/{categories}/g, '')
    .trim()

  const frameReply = (messages['enquiry_frame'] ?? '📐 *Our sizes & prices:*\n\n{pricing}\n\n🙏 Owner will reach out shortly!')
    .replace('{pricing}', pricingSample)

  const otherReply = messages['enquiry_other'] ?? '🙏 Thank you! The owner has noted your message and will contact you shortly.'

  return {
    frame: [
      { dir: 'out', text: 'Hi' },
      { dir: 'in', text: welcome },
      { dir: 'out', text: 'Do you have photo frames? What are the prices?' },
      { dir: 'in', text: frameReply },
    ] as Bubble[],
    other: [
      { dir: 'out', text: 'Hi' },
      { dir: 'in', text: welcome },
      { dir: 'out', text: 'Do you do passport size photo printing?' },
      { dir: 'in', text: otherReply },
    ] as Bubble[],
  }
}

function formatBubbleText(text: string) {
  return text.split('\n').map((line, i) => {
    const parts = line.split(/(\*[^*]+\*)/g)
    return (
      <span key={i}>
        {parts.map((part, j) =>
          part.startsWith('*') && part.endsWith('*')
            ? <strong key={j}>{part.slice(1, -1)}</strong>
            : part
        )}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    )
  })
}

const TIMES: Record<Scenario, string[]> = {
  frame: ['10:31', '10:31', '10:32', '10:32'],
  other: ['11:05', '11:05', '11:06', '11:06'],
}

export default function BotPhonePreview({
  messages,
  businessName,
  pricingSample,
}: {
  messages: Record<string, string>
  businessName: string
  pricingSample: string
}) {
  const [scenario, setScenario] = useState<Scenario>('frame')
  const [visibleCount, setVisibleCount] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const scenarios = buildScenarios(messages, businessName, pricingSample)
  const bubbles = scenarios[scenario]

  function startAnimation() {
    timerRef.current.forEach(clearTimeout)
    timerRef.current = []
    setVisibleCount(0)
    const delays = [300, 1200, 2400, 3800]
    delays.forEach((delay, i) => {
      const t = setTimeout(() => setVisibleCount(i + 1), delay)
      timerRef.current.push(t)
    })
  }

  useEffect(() => {
    startAnimation()
    return () => timerRef.current.forEach(clearTimeout)
  }, [scenario]) // eslint-disable-line react-hooks/exhaustive-deps

  const tabs: { key: Scenario; icon: string; label: string; desc: string }[] = [
    { key: 'frame', icon: '🖼️', label: 'Frame inquiry', desc: 'Customer asks about photo frames' },
    { key: 'other', icon: '💬', label: 'Other inquiry', desc: 'Unrecognised message — owner notified' },
  ]

  return (
    <>
      <style>{`
        .phone-shell {
          background: #1a1a1a;
          border-radius: 44px;
          padding: 10px;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.07),
            0 40px 80px rgba(0,0,0,0.4),
            0 16px 32px rgba(0,0,0,0.2),
            inset 0 0 0 1px rgba(255,255,255,0.04);
        }
        .phone-inner {
          border-radius: 36px;
          overflow: hidden;
          height: 560px;
          display: flex;
          flex-direction: column;
          background: #efeae2;
          position: relative;
        }
        .wa-header-bar {
          background: #075E54;
          padding: 34px 12px 10px;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .wa-chat-area {
          flex: 1;
          overflow-y: auto;
          padding: 10px 10px 6px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          scrollbar-width: none;
        }
        .wa-chat-area::-webkit-scrollbar { display: none; }
        .bubble-out {
          background: #dcf8c6;
          border-radius: 10px 10px 3px 10px;
          position: relative;
        }
        .bubble-in {
          background: #ffffff;
          border-radius: 10px 10px 10px 3px;
          position: relative;
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        .bubble-out::after {
          content: '';
          position: absolute;
          bottom: 0; right: -7px;
          border: 7px solid transparent;
          border-bottom-color: #dcf8c6;
          border-right: 0;
        }
        .bubble-in::after {
          content: '';
          position: absolute;
          bottom: 0; left: -7px;
          border: 7px solid transparent;
          border-bottom-color: #ffffff;
          border-left: 0;
        }
        @keyframes bubbleSlide {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .bubble-appear {
          animation: bubbleSlide 0.25s ease forwards;
        }
        @keyframes bounceDot {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
        .typing-dot { animation: bounceDot 1.1s infinite ease; }
        .typing-dot:nth-child(2) { animation-delay: 0.18s; }
        .typing-dot:nth-child(3) { animation-delay: 0.36s; }
        @keyframes pulseGreen {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        .pulse-green { animation: pulseGreen 2s infinite; }
      `}</style>

      <div className="flex flex-col items-center gap-4 w-full">

        {/* Toggle */}
        <div className="flex w-full items-center justify-between">
          <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Live Preview</span>
          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setScenario(t.key)}
                className={`text-[11px] font-semibold px-3 py-1.5 rounded-md transition-all ${
                  scenario === t.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Phone */}
        <div className="phone-shell w-[280px] flex-shrink-0">
          <div className="phone-inner">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-7 bg-[#1a1a1a] rounded-b-2xl z-20" />

            {/* WA Header */}
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
              <div className="flex gap-3 text-white/70 text-base">
                <span>📹</span><span>📞</span>
              </div>
            </div>

            {/* Chat */}
            <div className="wa-chat-area">
              <div className="self-center text-[10px] text-gray-600 bg-white/70 rounded-md px-2 py-0.5 font-mono mb-1">Today</div>

              {bubbles.map((b, i) => {
                if (i >= visibleCount) return null
                const isLast = i === visibleCount - 1
                const nextIsIn = i + 1 < bubbles.length && bubbles[i + 1].dir === 'in'
                const showTyping = isLast && b.dir === 'out' && nextIsIn && visibleCount < bubbles.length

                return (
                  <div key={`${scenario}-${i}`}>
                    <div className={`flex bubble-appear ${b.dir === 'out' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[82%] px-2.5 py-1.5 font-mono text-[10.5px] leading-[1.55] ${
                          b.dir === 'out' ? 'bubble-out' : 'bubble-in'
                        }`}
                      >
                        {formatBubbleText(b.text)}
                        <div className={`flex items-center justify-end gap-1 mt-0.5 text-[9px] ${
                          b.dir === 'out' ? 'text-[#7eb67e]' : 'text-gray-400'
                        }`}>
                          {TIMES[scenario][i]}
                          {b.dir === 'out' && <span className="text-[#53bdeb]">✓✓</span>}
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

            {/* Input bar */}
            <div className="bg-[#efeae2] px-2 py-1.5 flex items-center gap-1.5 flex-shrink-0">
              <span className="text-gray-400 text-xl">☺</span>
              <div className="flex-1 bg-white rounded-full px-3 py-1.5 text-[10px] font-mono text-gray-400">
                Type a message
              </div>
              <span className="text-gray-400 text-base">📎</span>
              <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center text-white text-sm flex-shrink-0">
                🎤
              </div>
            </div>
          </div>
        </div>

        {/* Scenario cards */}
        <div className="w-full flex flex-col gap-2">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setScenario(t.key)}
              className={`flex items-start gap-3 text-left px-3 py-2.5 rounded-xl border transition-all ${
                scenario === t.key
                  ? 'border-orange-400 bg-orange-50 shadow-[0_0_0_3px_rgba(249,115,22,0.08)]'
                  : 'border-gray-200 bg-white hover:border-orange-300'
              }`}
            >
              <span className="text-lg mt-0.5">{t.icon}</span>
              <div>
                <div className="text-[12px] font-semibold text-gray-700">{t.label}</div>
                <div className="text-[11px] text-gray-400 mt-0.5 leading-snug">{t.desc}</div>
              </div>
            </button>
          ))}
        </div>

      </div>
    </>
  )
}
