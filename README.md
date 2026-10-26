# MarketMind AI — Global Market Intelligence

A first runnable milestone for the MarketMind AI specification. It focuses on the technical-analysis engine, transparent baseline forecasts, and expanding-window walk-forward backtesting. It is a research tool, not a trading system.

## Included in this milestone

- Next.js App Router application with a responsive analyst dashboard.
- Server-side Alpha Vantage daily-data adapter (API key never goes to the browser).
- Explicit fictional demo mode when no API key is configured.
- SMA, EMA, RSI, MACD, Bollinger Bands, and ATR calculations.
- Historical drift forecast with volatility-scaled ranges for 1, 5, and 21 trading sessions.
- Expanding-window one-step-ahead backtest with MAE, RMSE, directional accuracy, forecast bias, and naive last-value MAE.
- Historical data CSV export.
- Unit tests for core calculations.
- Provider errors shown as unavailable; configured-provider failures do not silently substitute demo data.

## Not yet implemented

This milestone is not the entire production specification. It does not yet include user accounts, persistent watchlists/portfolios, a production database schema/migrations, news ingestion, a sourced economic calendar, corporate-action-adjusted backtesting, calibrated forecast probabilities, a trained ML model, durable job queue, or WhatsApp Business messaging. No automatic trading is included. Do not infer that these are operational from the UI.

## Requirements

- Node.js 20 or newer recommended
- npm
- Optional free Alpha Vantage API key: https://www.alphavantage.co/support/#api-key

## Run locally

```bash
npm install
cp .env.example .env.local
# Optional: edit .env.local and add ALPHA_VANTAGE_API_KEY=your_key
npm run dev
```

Open http://localhost:3000.

Without a key, the app generates deterministic fictional sample bars. The banner explicitly labels them as demo data. With a key, requests are made server-side to Alpha Vantage's `TIME_SERIES_DAILY` endpoint. Free plans have rate, symbol coverage, and history limits; provider data may be delayed. The adapter requests compact history for 3M and full history for 6M/1Y. Alpha Vantage may restrict full history by plan; if it rejects the request, the API shows the provider error instead of silently presenting 100 bars as a full year. The UI also warns when returned history is shorter than the selected range. Confirm current Alpha Vantage terms and exchange coverage before using or redistributing data. A symbol suffix such as `.BSE` is not guaranteed to be supported by the selected provider; test the exact symbol.

```bash
npm test
npm run build
```

## Environment variables

See `.env.example`. Keep credentials server-side. Do not prefix secret variables with `NEXT_PUBLIC_`, commit `.env.local`, or expose service-role keys in client code.

## Deploy to Vercel (free tier)

1. Push this project to a private or public GitHub repository.
2. Import the repository in Vercel.
3. Add `ALPHA_VANTAGE_API_KEY` under Project Settings → Environment Variables if you have one.
4. Redeploy after changing environment variables.
5. Open the deployed URL and check the data-source banner. If the provider rejects a symbol or the quota is exhausted, the UI should show an error rather than pretend that sample prices are real.

A Vercel deployment alone does not create a database or background worker. Supabase variables are placeholders for a future persistence milestone; this version does not yet use them.

## Methodology and limitations

- Indicators use close/high/low data returned by the configured provider. They are simple calculations, not recommendations.
- Forecast central estimates use the mean of up to 60 recent daily returns, bounded to ±2% daily drift. Ranges use historical return volatility and square-root-of-time scaling; this is a simple illustrative model, not a calibrated prediction interval.
- Backtesting uses an expanding history and predicts the next close from the previous close and the mean of up to 60 past returns. Each test prediction only sees past observations. The current adapter does not account for dividends, splits, survivorship bias, transaction costs, or changing symbol membership, so the metrics are not suitable for claiming profitability.
- Daily bars may be delayed; `freshness` records when this app retrieved the response, while the most recent candle date records the latest observation date. These timestamps are not interchangeable.
- No prediction guarantees an outcome. Do not use this application as sole basis for investment decisions.

## Project layout

```text
app/
  api/market/route.ts    # server-side data and analysis endpoint
  globals.css            # responsive dark analyst UI
  layout.tsx
  page.tsx
lib/
  analysis.ts            # indicators, forecasts, walk-forward metrics
  market-data.ts         # Alpha Vantage adapter + explicitly fictional demo bars
tests/
  analysis.test.ts
.env.example
```

## API

`GET /api/market?symbol=AAPL&range=1y`

Allowed ranges: `3m`, `6m`, `1y`. Returns candles, indicators, summary, forecasts, backtest results, provider metadata, and methodology. The response is generated server-side and returns HTTP 502 on provider failures.

## Optional Supabase persistence

1. Create a free Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in local `.env.local` or Vercel server-side environment variables.
4. Redeploy/restart. Each successful analysis request will append a run record. The API response includes a `persistence` status; without credentials, it explicitly says the run was not persisted.

The table has RLS enabled and intentionally has no public policies. The service-role key is powerful and must remain server-only. This initial table records analysis runs; it does not yet implement per-user authentication or private portfolios.
