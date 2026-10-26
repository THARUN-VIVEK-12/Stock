type Snapshot = { symbol:string; source:string; mode:string; referenceDate:string; latestClose:number; currency:string; forecasts:unknown; backtest:unknown; modelVersion:string };

/** Optional append-only Supabase persistence. Missing configuration is an explicit no-op. */
export async function persistAnalysis(snapshot: Snapshot): Promise<{configured:boolean; saved:boolean; message:string}> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { configured:false, saved:false, message:'Supabase is not configured; this analysis is not persisted.' };
  try {
    const response = await fetch(`${url}/rest/v1/market_analysis_runs`, {
      method:'POST', headers:{ apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json', Prefer:'return=minimal' },
      body:JSON.stringify({ symbol:snapshot.symbol, source:snapshot.source, data_mode:snapshot.mode, reference_date:snapshot.referenceDate, latest_close:snapshot.latestClose, currency:snapshot.currency, forecasts:snapshot.forecasts, backtest:snapshot.backtest, model_version:snapshot.modelVersion })
    });
    if (!response.ok) return { configured:true, saved:false, message:`Supabase persistence failed (HTTP ${response.status}); analysis remains available for this request.` };
    return { configured:true, saved:true, message:'Analysis run appended to Supabase.' };
  } catch { return { configured:true, saved:false, message:'Supabase could not be reached; analysis remains available for this request.' }; }
}
