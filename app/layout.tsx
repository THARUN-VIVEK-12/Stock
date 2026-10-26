import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'MarketMind AI | Global Market Intelligence', description: 'Transparent market research, technical analysis, baseline forecasts and walk-forward backtesting.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
