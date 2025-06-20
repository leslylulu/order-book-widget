# Assignment option B

## Goal
Display a live price ticker and rolling list of price updates from a mocked SSE endpoint.

## Requirements Create `OrderBook.tsx` that:
1. Opens an SSE connection to `/api/order-stream`.
2. Shows last price and maintains the latest 20 updates in state.
3. Renders bid/ask table (timestamp | price); highlight price up/down ticks (Green blink if price ↑, red if ↓).
4. Gracefully handle disconnect / reconnect.
5. Has unit test for the stream handler or a cypress test covering a happy path.

### Creative Freedom (Stretch – optional)
• Add a high‑/low‑water‑mark column, mini‑sparkline, etc.

## File tree
order‑book‑widget/
├─ app/
│  ├─ api/
│  │  └─ order‑stream/route.ts     ← mock SSE
│  └─ page.tsx
├─ components/OrderBook.tsx        ← implement
├─ jest.config.js
├─ package.json
└─ tsconfig.json
