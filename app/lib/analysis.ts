export type Candle = { date: string; open: number; high: number; low: number; close: number; volume: number };
export type ForecastPoint = { horizon: number; label: string; estimate: number; lower: number; upper: number; changePct: number };

const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const std = (xs: number[]) => { if (xs.length < 2) return 0; const m = mean(xs); return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)); };
export const pctReturns = (prices: number[]) => prices.slice(1).map((p, i) => prices[i] ? p / prices[i] - 1 : 0);
export function sma(values: number[], period: number): (number | null)[] {
  return values.map((_, i) => i + 1 < period ? null : mean(values.slice(i + 1 - period, i + 1)));
}
export function ema(values: number[], period: number): (number | null)[] {
  if (!values.length) return [];
  const out: (number | null)[] = Array(values.length).fill(null); if (values.length < period) return out;
  const k = 2 / (period + 1); let current = mean(values.slice(0, period)); out[period - 1] = current;
  for (let i = period; i < values.length; i++) { current = values[i] * k + current * (1 - k); out[i] = current; }
  return out;
}
export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = Array(values.length).fill(null); if (values.length <= period) return out;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) { const d = values[i] - values[i - 1]; gains += Math.max(0, d); losses += Math.max(0, -d); }
  let avgGain = gains / period, avgLoss = losses / period;
  out[period] = avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) { const d = values[i] - values[i - 1]; avgGain = (avgGain * (period - 1) + Math.max(0, d)) / period; avgLoss = (avgLoss * (period - 1) + Math.max(0, -d)) / period; out[i] = avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + avgGain / avgLoss); }
  return out;
}
export function macd(values: number[]) {
  const fast = ema(values, 12), slow = ema(values, 26);
  const line = values.map((_, i) => fast[i] != null && slow[i] != null ? (fast[i] as number) - (slow[i] as number) : null);
  const signal: (number | null)[] = Array(values.length).fill(null);
  const first = line.findIndex(v => v != null);
  const signalStart = first < 0 ? -1 : first + 8;
  if (signalStart >= 0 && signalStart < line.length) {
    let current = mean(line.slice(first, signalStart + 1).map(v => v as number));
    signal[signalStart] = current;
    const k = 2 / 10;
    for (let i = signalStart + 1; i < line.length; i++) { current = (line[i] as number) * k + current * (1 - k); signal[i] = current; }
  }
  const histogram = line.map((v, i) => v == null || signal[i] == null ? null : (v as number) - (signal[i] as number));
  return { line, signal, histogram };
}
export function bollinger(values: number[], period = 20, multiplier = 2) {
  const middle = sma(values, period);
  const upper = values.map((_, i) => i + 1 < period ? null : (middle[i] as number) + multiplier * std(values.slice(i + 1 - period, i + 1)));
  const lower = values.map((_, i) => i + 1 < period ? null : (middle[i] as number) - multiplier * std(values.slice(i + 1 - period, i + 1)));
  return { middle, upper, lower };
}
export function atr(candles: Candle[], period = 14): (number | null)[] {
  const tr = candles.map((c, i) => i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - candles[i - 1].close), Math.abs(c.low - candles[i - 1].close)));
  const out: (number | null)[] = Array(candles.length).fill(null); if (candles.length < period) return out;
  let value = mean(tr.slice(0, period)); out[period - 1] = value;
  for (let i = period; i < tr.length; i++) { value = (value * (period - 1) + tr[i]) / period; out[i] = value; }
  return out;
}
export function indicators(candles: Candle[]) {
  const close = candles.map(c => c.close); const m = macd(close); const b = bollinger(close);
  return candles.map((c, i) => ({ ...c, sma20: sma(close, 20)[i], sma50: sma(close, 50)[i], ema20: ema(close, 20)[i], rsi14: rsi(close)[i], macd: m.line[i], macdSignal: m.signal[i], macdHistogram: m.histogram[i], bbUpper: b.upper[i], bbMiddle: b.middle[i], bbLower: b.lower[i], atr14: atr(candles)[i] }));
}

/** Forecast: drift baseline plus historical-return volatility interval. Not an investment recommendation. */
export function forecast(candles: Candle[]): ForecastPoint[] {
  const prices = candles.map(c => c.close); if (prices.length < 30) return [];
  const returns = pctReturns(prices); const recent = returns.slice(-60); const dailyDrift = Math.max(-0.02, Math.min(0.02, mean(recent)));
  const dailyVol = std(recent); const last = prices[prices.length - 1];
  return [{horizon:1,label:'1 session',estimate:last * (1 + dailyDrift),lower:last * (1 + dailyDrift - dailyVol),upper:last * (1 + dailyDrift + dailyVol),changePct:dailyDrift*100},
    {horizon:5,label:'5 sessions',estimate:last * Math.pow(1 + dailyDrift,5),lower:last * Math.exp(dailyDrift*5 - 1.28*dailyVol*Math.sqrt(5)),upper:last * Math.exp(dailyDrift*5 + 1.28*dailyVol*Math.sqrt(5)),changePct:(Math.pow(1+dailyDrift,5)-1)*100},
    {horizon:21,label:'1 month',estimate:last * Math.pow(1 + dailyDrift,21),lower:last * Math.exp(dailyDrift*21 - 1.28*dailyVol*Math.sqrt(21)),upper:last * Math.exp(dailyDrift*21 + 1.28*dailyVol*Math.sqrt(21)),changePct:(Math.pow(1+dailyDrift,21)-1)*100}];
}

/** Rolling one-step forecast evaluation. Each forecast only uses observations before its target. */
export function backtest(candles: Candle[], minTrain = 30) {
  const prices = candles.map(c => c.close); const errors: number[] = []; let directionCorrect = 0, directionN = 0; let baselineErrors: number[] = [];
  for (let i = minTrain; i < prices.length; i++) {
    const train = prices.slice(0, i); const returns = pctReturns(train).slice(-60); const drift = mean(returns);
    const predicted = train[train.length - 1] * (1 + drift); const actual = prices[i]; errors.push(actual - predicted);
    const naive = train[train.length - 1]; baselineErrors.push(actual - naive);
    if (actual !== train[train.length - 1]) { directionN++; if (Math.sign(actual - train[train.length - 1]) === Math.sign(predicted - train[train.length - 1])) directionCorrect++; }
  }
  if (!errors.length) return { sampleSize: 0, mae: null, rmse: null, directionalAccuracy: null, forecastBias: null, naiveMae: null, note: 'At least 31 observations are required for walk-forward evaluation.' };
  const abs = errors.map(Math.abs);
  return { sampleSize: errors.length, mae: mean(abs), rmse: Math.sqrt(mean(errors.map(e => e*e))), directionalAccuracy: directionN ? directionCorrect / directionN * 100 : null, forecastBias: mean(errors), naiveMae: mean(baselineErrors.map(Math.abs)), note: 'Expanding-window, one-step-ahead evaluation; no future observations are used in each fit.' };
}
export function summarize(candles: Candle[]) {
  const close = candles.map(c => c.close); const latest = candles[candles.length - 1]; const previous = candles[candles.length - 2];
  const allReturns = pctReturns(close); const rsiValues = rsi(close); const sma20Values = sma(close,20); const sma50Values = sma(close,50); const latestRsi = rsiValues[rsiValues.length - 1] ?? null; const sma20Last = sma20Values[sma20Values.length - 1] ?? null; const sma50Last = sma50Values[sma50Values.length - 1] ?? null;
  return { latest, previousClose: previous?.close ?? null, change: previous ? latest.close - previous.close : 0, changePct: previous ? (latest.close / previous.close - 1) * 100 : 0,
    high52: Math.max(...candles.slice(-252).map(c => c.high)), low52: Math.min(...candles.slice(-252).map(c => c.low)), volatilityAnnualized: std(allReturns.slice(-60)) * Math.sqrt(252) * 100,
    rsi14: latestRsi, sma20: sma20Last, sma50: sma50Last, trend: sma20Last == null || sma50Last == null ? 'Insufficient history' : latest.close > sma20Last && sma20Last > sma50Last ? 'Uptrend' : latest.close < sma20Last && sma20Last < sma50Last ? 'Downtrend' : 'Mixed' };
}
