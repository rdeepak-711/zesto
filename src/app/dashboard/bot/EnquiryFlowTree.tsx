'use client'

// ── Types ─────────────────────────────────────────────────────────────────────

type TreeNode = {
  label: string
  isBot?: boolean
  isUser?: boolean
  isRoot?: boolean
  isBranch?: boolean
}

// ── Root chain (before the 3-way split) ──────────────────────────────────────

const ROOT_NODES: TreeNode[] = [
  { label: 'Customer sends a message', isRoot: true },
  { label: 'Hi! Welcome to [Studio Name] 📸\nWhat are you looking for today?', isBot: true },
  { label: 'Customer types their request (free text)', isUser: true },
  { label: 'Keyword router detects intent', isBranch: true },
]

// ── Branch definitions ────────────────────────────────────────────────────────

type Branch = {
  id: string
  title: string
  headerBg: string
  headerText: string
  headerBorder: string
  dotColor: string
  connectorColor: string
  nodeBot: string
  nodeUser: string
  steps: TreeNode[]
  leafMsg: string
  leafNote: string
}

const BRANCHES: Branch[] = [
  {
    id: 'frames',
    title: 'Photo Frames 🖼️',
    headerBg: 'bg-blue-50',
    headerText: 'text-blue-800',
    headerBorder: 'border-blue-200',
    dotColor: 'bg-blue-500',
    connectorColor: 'bg-blue-200',
    nodeBot: 'bg-blue-50/60 border-blue-100',
    nodeUser: 'bg-white border-gray-100',
    steps: [
      { label: 'Which type of frame?\n1. Standard / Embossing / Alloy\n2. MDF (table / wall / shadow)\n3. Canvas / LED / Backlight\n4. Baby / Collage / Multi-heart\n5. Sublimation / Crystal / Metal\n6. Twin / Miniature', isBot: true },
      { label: 'Customer picks type (1–6)', isUser: true },
      { label: 'Which size?\n1–10: standard sizes (4×6 → 20×30)\n11: Custom\nOr type a custom size', isBot: true },
      { label: 'Customer picks size', isUser: true },
      { label: "What's the occasion?\n1. Gift 🎁  2. Home decor 🏠\n3. Personal memory 📷\n4. Event / Function 🎉  5. Other", isBot: true },
      { label: 'Customer picks occasion', isUser: true },
      { label: 'How many pieces do you need?', isBot: true },
      { label: 'Customer types quantity', isUser: true },
      { label: 'Would you like to share a photo now? 📸\n(Optional — type skip to continue.)', isBot: true },
      { label: 'Customer sends photo or types skip', isUser: true },
      { label: 'And your name please?', isBot: true },
      { label: 'Customer types name', isUser: true },
    ],
    leafMsg: 'Thank you, [Name]! 🙏 We\'ve noted your enquiry —\n[Frame Type], size [Size], qty [N], for [Occasion].\nOur team will reach out to you shortly. 😊',
    leafNote: 'Owner WhatsApp alert sent',
  },
  {
    id: 'acrylic',
    title: 'Acrylic 🎨',
    headerBg: 'bg-amber-50',
    headerText: 'text-amber-800',
    headerBorder: 'border-amber-200',
    dotColor: 'bg-amber-500',
    connectorColor: 'bg-amber-200',
    nodeBot: 'bg-amber-50/60 border-amber-100',
    nodeUser: 'bg-white border-gray-100',
    steps: [
      { label: 'Which acrylic product?\n1. Life-size standee  2. Photo frame\n3. Wall clock  4. Bed lamp / table top\n5. Light box  6. Flat print (4mm)\n7. Lamp gift  8. Illusion gods\n9. Trophy / award  10. Cake topper', isBot: true },
      { label: 'Customer picks type (1–10)', isUser: true },
      { label: 'Product-specific spec question\n(size / height / text / design)', isBot: true },
      { label: 'Customer answers spec', isUser: true },
      { label: "What's the occasion?\n1. Gift 🎁  2. Home decor 🏠\n3. Personal memory 📷\n4. Event / Function 🎉  5. Other", isBot: true },
      { label: 'Customer picks occasion', isUser: true },
      { label: 'How many pieces do you need?', isBot: true },
      { label: 'Customer types quantity', isUser: true },
      { label: 'Would you like to share a photo or design reference? 📸\n(Optional — type skip to continue.)', isBot: true },
      { label: 'Customer sends photo or types skip', isUser: true },
      { label: 'And your name please?', isBot: true },
      { label: 'Customer types name', isUser: true },
    ],
    leafMsg: 'Thank you, [Name]! 🙏 We\'ve noted your enquiry —\n[Acrylic Type], qty [N], for [Occasion].\nOur team will reach out to you shortly. 😊',
    leafNote: 'Owner WhatsApp alert sent',
  },
  {
    id: 'other',
    title: 'Unrecognised 💬',
    headerBg: 'bg-rose-50',
    headerText: 'text-rose-800',
    headerBorder: 'border-rose-200',
    dotColor: 'bg-rose-500',
    connectorColor: 'bg-rose-200',
    nodeBot: 'bg-rose-50/60 border-rose-100',
    nodeUser: 'bg-white border-gray-100',
    steps: [
      { label: "We didn't quite catch that! 😊\nPlease type your name, phone number,\nand what you need — our team will\nget back to you.", isBot: true },
      { label: 'Customer types name + phone + requirement', isUser: true },
    ],
    leafMsg: 'Thank you! 🙏 Our team has received your\nmessage and will reach out to you shortly. 😊',
    leafNote: 'Owner WhatsApp alert sent (manual follow-up)',
  },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function StepNode({ node, branch }: { node: TreeNode; branch: Branch }) {
  if (node.isBot) {
    return (
      <div className={`rounded-xl border ${branch.nodeBot} px-3 py-2`}>
        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">Bot</span>
        <pre className="text-[11px] text-gray-700 font-sans whitespace-pre-wrap leading-relaxed">{node.label}</pre>
      </div>
    )
  }
  return (
    <div className={`rounded-xl border ${branch.nodeUser} px-3 py-2`}>
      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">Customer</span>
      <p className="text-[11px] text-gray-500 italic leading-relaxed">{node.label}</p>
    </div>
  )
}

function BranchColumn({ branch }: { branch: Branch }) {
  return (
    <div className="flex flex-col items-center w-full">
      {/* Header */}
      <div className={`w-full rounded-xl border ${branch.headerBorder} ${branch.headerBg} px-3 py-2 flex items-center gap-2 mb-2`}>
        <span className={`w-2 h-2 rounded-full ${branch.dotColor} flex-shrink-0`} />
        <span className={`text-xs font-bold ${branch.headerText}`}>{branch.title}</span>
      </div>

      {/* Steps */}
      <div className="w-full space-y-1.5">
        {branch.steps.map((step, i) => (
          <div key={i}>
            <StepNode node={step} branch={branch} />
            {i < branch.steps.length - 1 && (
              <div className="flex justify-center my-0.5">
                <div className={`w-px h-3 ${branch.connectorColor}`} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Connector to leaf */}
      <div className="flex justify-center my-1.5">
        <div className={`w-px h-4 ${branch.connectorColor}`} />
      </div>

      {/* Leaf */}
      <div className={`w-full rounded-xl border-2 ${branch.headerBorder} ${branch.headerBg} px-3 py-2.5`}>
        <div className="flex items-start gap-2">
          <span className="text-base flex-shrink-0 mt-0.5">🏁</span>
          <div>
            <pre className={`text-[11px] font-sans ${branch.headerText} whitespace-pre-wrap leading-relaxed font-semibold`}>{branch.leafMsg}</pre>
            <p className="text-[10px] text-gray-400 mt-1 font-medium">{branch.leafNote}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Root chain ────────────────────────────────────────────────────────────────

function RootChain() {
  return (
    <div className="flex flex-col items-center mb-4">
      {ROOT_NODES.map((node, i) => (
        <div key={i} className="flex flex-col items-center w-full max-w-sm">
          {node.isRoot && (
            <div className="bg-slate-900 text-white text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              {node.label}
            </div>
          )}
          {node.isBot && (
            <div className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 mt-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">Bot</span>
              <pre className="text-[11px] text-gray-700 font-sans whitespace-pre-wrap leading-relaxed">{node.label}</pre>
            </div>
          )}
          {node.isUser && (
            <div className="w-full rounded-xl border border-gray-100 bg-white px-3 py-2 mt-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">Customer</span>
              <p className="text-[11px] text-gray-500 italic">{node.label}</p>
            </div>
          )}
          {node.isBranch && (
            <div className="w-full rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 mt-1.5 text-center">
              <span className="text-xs font-bold text-violet-700">{node.label}</span>
            </div>
          )}
          {i < ROOT_NODES.length - 1 && (
            <div className="w-px h-3 bg-gray-200 my-0.5" />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function EnquiryFlowTree() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900">Conversation Flow</h2>
        <p className="text-xs text-gray-400 mt-0.5">Top-down view of every path a customer can take</p>
      </div>

      <div className="px-5 py-4">
        <RootChain />

        {/* Split indicator */}
        <div className="flex items-center justify-center gap-1 mb-3">
          <div className="flex-1 h-px bg-gray-200" />
          <div className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
          </div>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* 3 branches */}
        <div className="grid grid-cols-3 gap-4 items-start">
          {BRANCHES.map(branch => (
            <BranchColumn key={branch.id} branch={branch} />
          ))}
        </div>
      </div>
    </div>
  )
}
