import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOutsideDetectionForDeals } from '@/hooks/useOutsideDetectionForDeals';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface DealRow {
  id: string;
  created_at: string;
  crm_contacts: { email: string | null } | null;
}

interface RpcRow {
  deal_id: string;
  is_outside: boolean;
  product_name: string | null;
}

interface DiffRow {
  deal_id: string;
  email: string | null;
  ts_is_outside: boolean;
  ts_product: string | null;
  rpc_is_outside: boolean;
  rpc_product: string | null;
}

const SAMPLE_PER_BUCKET = 60;

async function loadSampleDeals(): Promise<DealRow[]> {
  // Collect ~SAMPLE_PER_BUCKET customer_emails from each bucket
  const buckets = await Promise.all([
    supabase
      .from('hubla_transactions')
      .select('customer_email')
      .in('product_category', ['contrato', 'incorporador'])
      .ilike('product_name', '%contrato%')
      .eq('sale_status', 'completed')
      .not('customer_email', 'is', null)
      .order('sale_date', { ascending: false })
      .limit(SAMPLE_PER_BUCKET * 3),
    supabase
      .from('hubla_transactions')
      .select('customer_email')
      .not('product_name', 'ilike', '%contrato%')
      .eq('sale_status', 'completed')
      .not('customer_email', 'is', null)
      .order('sale_date', { ascending: false })
      .limit(SAMPLE_PER_BUCKET * 3),
    supabase
      .from('hubla_transactions')
      .select('customer_email')
      .eq('sale_status', 'completed')
      .or('product_name.ilike.%A001%,product_name.ilike.%A002%,product_name.ilike.%A003%,product_name.ilike.%A004%,product_name.ilike.%A009%,product_name.ilike.%INCORPORADOR%,product_name.ilike.%ANTICRISE%')
      .not('customer_email', 'is', null)
      .order('sale_date', { ascending: false })
      .limit(SAMPLE_PER_BUCKET * 3),
    supabase
      .from('hubla_transactions')
      .select('customer_email')
      .eq('sale_status', 'completed')
      .ilike('offer_name', 'Contrato CLS%')
      .not('customer_email', 'is', null)
      .order('sale_date', { ascending: false })
      .limit(SAMPLE_PER_BUCKET * 3),
  ]);

  const emails = new Set<string>();
  for (const b of buckets) {
    if (b.error) throw b.error;
    for (const row of (b.data || []) as { customer_email: string | null }[]) {
      const e = row.customer_email?.toLowerCase().trim();
      if (e) emails.add(e);
      if (emails.size >= SAMPLE_PER_BUCKET * 4) break;
    }
  }

  // Fetch deals for those emails (cap at 240 from buckets) + 60 random recent deals
  const emailList = Array.from(emails).slice(0, SAMPLE_PER_BUCKET * 4);

  const dealsByEmail: DealRow[] = [];
  if (emailList.length) {
    const chunkSize = 200;
    for (let i = 0; i < emailList.length; i += chunkSize) {
      const chunk = emailList.slice(i, i + chunkSize);
      const { data, error } = await supabase
        .from('crm_deals')
        .select('id, created_at, crm_contacts!inner(email)')
        .in('crm_contacts.email', chunk)
        .limit(500);
      if (error) throw error;
      dealsByEmail.push(...((data || []) as any[]));
    }
  }

  // Add 60 random recent deals (with email) to cover "no contract" / "with R1" cases
  const { data: recentData, error: recentErr } = await supabase
    .from('crm_deals')
    .select('id, created_at, crm_contacts!inner(email)')
    .order('created_at', { ascending: false })
    .limit(60);
  if (recentErr) throw recentErr;

  const allMap = new Map<string, DealRow>();
  for (const d of [...dealsByEmail, ...((recentData || []) as any[])]) {
    allMap.set(d.id, d as DealRow);
    if (allMap.size >= 300) break;
  }
  return Array.from(allMap.values());
}

export default function OutsideDetectionDiff() {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rpcResult, setRpcResult] = useState<Map<string, RpcRow> | null>(null);
  const [rpcRunning, setRpcRunning] = useState(false);

  const tsQuery = useOutsideDetectionForDeals(deals);

  const handleLoad = async () => {
    setLoading(true);
    setError(null);
    setRpcResult(null);
    try {
      const sample = await loadSampleDeals();
      setDeals(sample);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleRunRpc = async () => {
    if (!deals.length) return;
    setRpcRunning(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('get_outside_detection_for_deals', {
        p_deal_ids: deals.map(d => d.id),
      });
      if (rpcErr) throw rpcErr;
      const map = new Map<string, RpcRow>();
      for (const row of (data || []) as RpcRow[]) {
        map.set(row.deal_id, row);
      }
      setRpcResult(map);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setRpcRunning(false);
    }
  };

  // Diff calculation
  const tsMap = tsQuery.data;
  const diffs: DiffRow[] = [];
  let equalCount = 0;
  let total = 0;
  if (tsMap && rpcResult) {
    for (const d of deals) {
      total++;
      const ts = tsMap.get(d.id);
      const rpc = rpcResult.get(d.id);
      const tsIsOutside = !!ts?.isOutside;
      const rpcIsOutside = !!rpc?.is_outside;
      const tsProduct = ts?.productName ?? null;
      const rpcProduct = rpc?.product_name ?? null;
      const sameOutside = tsIsOutside === rpcIsOutside;
      const sameProduct = (tsProduct || '') === (rpcProduct || '');
      if (sameOutside && sameProduct) {
        equalCount++;
      } else {
        diffs.push({
          deal_id: d.id,
          email: d.crm_contacts?.email ?? null,
          ts_is_outside: tsIsOutside,
          ts_product: tsProduct,
          rpc_is_outside: rpcIsOutside,
          rpc_product: rpcProduct,
        });
      }
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Outside Detection — TS vs RPC Diff</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Rota temporária de validação. Compara o hook <code>useOutsideDetectionForDeals</code> com o RPC{' '}
          <code>get_outside_detection_for_deals</code> sobre uma amostra de ~300 deals.
        </p>
      </div>

      <div className="flex gap-3 items-center">
        <Button onClick={handleLoad} disabled={loading}>
          {loading ? 'Carregando amostra…' : '1. Carregar amostra de ~300 deals'}
        </Button>
        <Button onClick={handleRunRpc} disabled={!deals.length || rpcRunning || tsQuery.isLoading}>
          {rpcRunning ? 'Executando RPC…' : '2. Executar RPC e comparar'}
        </Button>
      </div>

      {error && (
        <div className="rounded border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="text-sm space-y-1">
        <div>Deals carregados: <strong>{deals.length}</strong></div>
        <div>Hook TS: {tsQuery.isLoading ? 'executando…' : tsQuery.data ? `pronto (${tsQuery.data.size} marcados outside)` : 'aguardando'}</div>
        <div>RPC: {rpcRunning ? 'executando…' : rpcResult ? `pronto (${rpcResult.size} marcados outside)` : 'aguardando'}</div>
      </div>

      {tsMap && rpcResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded border p-4">
              <div className="text-xs text-muted-foreground">Total comparados</div>
              <div className="text-2xl font-semibold">{total}</div>
            </div>
            <div className="rounded border p-4">
              <div className="text-xs text-muted-foreground">Iguais</div>
              <div className="text-2xl font-semibold text-green-600">{equalCount}</div>
            </div>
            <div className="rounded border p-4">
              <div className="text-xs text-muted-foreground">Divergentes</div>
              <div className="text-2xl font-semibold text-red-600">{diffs.length}</div>
            </div>
          </div>

          {diffs.length > 0 && (
            <div className="rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>deal_id</TableHead>
                    <TableHead>email</TableHead>
                    <TableHead>TS is_outside</TableHead>
                    <TableHead>TS product</TableHead>
                    <TableHead>RPC is_outside</TableHead>
                    <TableHead>RPC product</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diffs.map(d => (
                    <TableRow key={d.deal_id}>
                      <TableCell className="font-mono text-xs">{d.deal_id}</TableCell>
                      <TableCell className="text-xs">{d.email}</TableCell>
                      <TableCell>{String(d.ts_is_outside)}</TableCell>
                      <TableCell className="text-xs">{d.ts_product ?? '—'}</TableCell>
                      <TableCell>{String(d.rpc_is_outside)}</TableCell>
                      <TableCell className="text-xs">{d.rpc_product ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}