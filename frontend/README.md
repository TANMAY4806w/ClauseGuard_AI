# ClauseGuard AI — Frontend Client

> **Executive Legal Risk Intelligence Dashboard & Interactive Legal Counsel Copilot**  
> Built with **React 18 + TypeScript + Vite + Tailwind CSS v4** and real-time audio streaming via **AssemblyAI v3 WebSocket**.

---

## 🌟 Key Features

1. **Autonomous Contract Auditing & Ingestion:**
   - Drag-and-drop PDF upload with client-side file size and format validation.
   - **1-Click Sample Contract:** Instantly loads a sample hazardous vendor agreement for demonstration without searching for local files.
   - Real-time animated progress stepper tracking asynchronous backend ingestion: `PARSING` $\to$ `EMBEDDING` $\to$ `AUDITING` $\to$ `COMPLETED`.

2. **Live Speech-to-Text via AssemblyAI v3 WebSocket:**
   - Single-click microphone recording powered by the `useLiveTranscription` custom hook.
   - Streams 16kHz mono 16-bit linear PCM binary buffers to `wss://streaming.assemblyai.com/v3/ws`.
   - Real-time partial transcript preview rendered while speaking with zero perceptible latency (<200ms).
   - Available on contract upload (for client bargaining position) and directly inside the legal chat input bar.

3. **Executive Risk Intelligence Dossier:**
   - SVG circular risk score gauge (0 to 100) with dynamic gradient indicators (`CRITICAL`, `HIGH`, `MODERATE`, `FAVORABLE`).
   - Category severity breakdown pills with instant filtering (`ALL`, `CRITICAL`, `HIGH`, `MEDIUM`, `SAFE`).
   - Verbatim contract citations referencing exact physical PDF page numbers and section headers.
   - Statutory grounding notes citing the **Indian Contract Act, 1872** (e.g. Section 27 non-compete invalidity, Section 73/74 liquidated damages, Section 124 indemnity).
   - One-click copy buttons for recommended substitute contract language (redlines).

4. **Conversational Legal Counsel Copilot (Chatbot):**
   - Interactive split-screen panel on desktop and responsive slide drawer on mobile.
   - Senior corporate counsel persona providing strategic pushback advice, compromise terms, and ready-to-send negotiation emails.
   - Quick-action suggestion chips for rapid legal questions.
   - "Discuss with Copilot" trigger on each flagged clause card that automatically routes the specific clause into the chat thread.

---

## 🏗️ Directory Architecture

```
frontend/
├── public/
│   ├── favicon.svg              # Shield brand icon
│   └── sample_contract.pdf      # Bundled sample hazardous contract
├── src/
│   ├── api/
│   │   └── client.ts            # Type-safe Axios client for /api/v1
│   ├── components/
│   │   ├── Dropzone.tsx         # Drag-and-drop file upload & voice context recorder
│   │   ├── LegalCopilot.tsx     # Conversational counsel chat with live mic input
│   │   ├── Navbar.tsx           # Sticky brand navigation & reset controls
│   │   ├── ProgressStepper.tsx  # Pipeline execution stage tracker
│   │   ├── RiskCard.tsx         # Flagged clause card with citations & redlines
│   │   └── RiskGauge.tsx        # SVG circular risk score meter & breakdown
│   ├── hooks/
│   │   └── useLiveTranscription.ts # AudioContext 16kHz PCM streaming hook
│   ├── types/
│   │   └── index.ts             # Strict TypeScript definitions matching Pydantic schemas
│   ├── App.tsx                  # Main responsive split-view & state machine
│   ├── index.css                # Tailwind CSS v4 setup & custom audio animations
│   └── main.tsx                 # React DOM root entrypoint
├── index.html                   # HTML5 template with dark theme metadata
├── package.json                 # Dependencies (React, Axios, Lucide, Tailwind v4)
├── tsconfig.json                # Strict TypeScript configuration
└── vite.config.ts               # Vite configuration with @tailwindcss/vite & API proxy
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (tested on Node v20/v24)
- npm or pnpm

### Installation
```bash
cd frontend
npm install
```

### Running in Development
```bash
npm run dev
```
The development server will run at `http://localhost:5173`. API requests to `/api/*` are automatically proxied to the backend at `http://localhost:8000`.

### Production Build & Typecheck
```bash
npm run build
```
Generates an optimized static bundle in `frontend/dist/` with zero TypeScript errors.
