import { NextRequest, NextResponse } from 'next/server';
import { backtest, forecast, indicators, summarize } from '@/lib/analysis';
import { getMarketData } from '@/lib/market-data';
import { persistAnalysis } from '@/lib/persistence';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol') || 'AAPL';
  const range = request.nextUrl.searchParams.get('range') || '1y';
  if (!/^[A-Za-z0-9.^=_-]{1,24}$/.test(symbol)) return NextResponse.json({ error: 'Invalid symbol. Use letters, numbers, dot, caret, equals, underscore, or hyphen.' }, { status: 400 });
  if (!['3m','6m','1y'].includes(range)) return NextResponse.json({ error: 'Unsupported range. Choose 3m, 6m, or 1y.' }, { status: 400 });
  try {
    const data = await getMarketData(symbol, range);
    if (data.candles.length < 2) return NextResponse.json({ error: 'Not enough observations were returned for analysis.' }, { status: 422 });
    const summary = summarize(data.candles);
    const forecasts = forecast(data.candles);
    const backtestResults = backtest(data.candles);
    const persistence = await persistAnalysis({ symbol:data.symbol, source:data.source, mode:data.mode, referenceDate:summary.latest.date, latestClose:summary.latest.close, currency:data.currency, forecasts, backtest:backtestResults, modelVersion:'drift-volatility-v1' });
    return NextResponse.json({ ...data, summary, history: indicators(data.candles), forecasts, backtest: backtestResults, persistence, generatedAt: new Date().toISOString(), methodology: { forecast: 'Historical-return drift baseline with volatility-based illustrative intervals; not a trained machine-learning model.', backtest: 'Expanding-window walk-forward, one-session-ahead evaluation using only past closes.', accuracy: 'Metrics describe this dataset and this simple baseline only; they do not imply future performance.' } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected market data error.';
    return NextResponse.json({ error: message, sourceStatus: 'unavailable', hint: 'Check the symbol, provider API key, provider quota, and network connectivity. No demo values were substituted for a failed configured provider.' }, { status: 502 });
  }
}
