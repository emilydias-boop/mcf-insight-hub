import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileText, Download, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { loadXLSX } from '@/lib/lazyExport';
import { toast } from 'sonner';
import { useProposals, type Proposal } from '@/hooks/useConsorcioPostMeeting';
import { ViewRegistrationDialog } from './ViewRegistrationDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

interface UploadRow {
  nome: string;
  email: string;
  telefone: string;
}

type MatchQuality = 'phone' | 'email' | 'none';

interface MatchResult extends UploadRow {
  proposal: Proposal | null;
  quality: MatchQuality;
}

const onlyDigits = (s: string) => (s || '').toString().replace(/\D/g, '');

export function MatchSocioParceiroTab() {
  const { data: propostas = [], isLoading } = useProposals();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [viewTarget, setViewTarget] = useState<Proposal | null>(null);
  const [filter, setFilter] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [uploadMeta, setUploadMeta] = useState<{
    id: string;
    uploaded_by_name: string | null;
    created_at: string;
  } | null>(null);

  // Load latest saved upload (shared across all users with CRM Consórcio access)
  const { data: latestUpload } = useQuery({
    queryKey: ['consorcio-match-upload-latest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_match_uploads')
        .select('id, file_name, uploaded_by, uploaded_by_name, row_count, rows, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 1000,
  });

  // Hydrate local state from the latest saved upload on first load
  useEffect(() => {
    if (latestUpload && !fileName) {
      const savedRows = Array.isArray(latestUpload.rows)
        ? (latestUpload.rows as unknown as UploadRow[])
        : [];
      setRows(savedRows);
      setFileName(latestUpload.file_name);
      setUploadMeta({
        id: latestUpload.id,
        uploaded_by_name: latestUpload.uploaded_by_name,
        created_at: latestUpload.created_at,
      });
    }
  }, [latestUpload, fileName]);

  const saveUpload = useMutation({
    mutationFn: async (payload: { fileName: string; parsed: UploadRow[] }) => {
      if (!user) throw new Error('Usuário não autenticado');
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      const { data, error } = await supabase
        .from('consorcio_match_uploads')
        .insert({
          file_name: payload.fileName,
          uploaded_by: user.id,
          uploaded_by_name: profile?.full_name || user.email || 'Desconhecido',
          row_count: payload.parsed.length,
          rows: payload.parsed as any,
        })
        .select('id, uploaded_by_name, created_at')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setUploadMeta(data as any);
      queryClient.invalidateQueries({ queryKey: ['consorcio-match-upload-latest'] });
      toast.success('Planilha salva — visível para todos com acesso ao CRM Consórcio.');
    },
    onError: (e: any) => toast.error('Erro ao salvar planilha: ' + (e?.message || e)),
  });

  // Indexes for fast lookup
  const indexes = useMemo(() => {
    const byPhone9 = new Map<string, Proposal>();
    const byEmail = new Map<string, Proposal>();
    for (const p of propostas) {
      const ph = onlyDigits(p.contact_phone || '');
      const suf = ph.slice(-9);
      if (suf && !byPhone9.has(suf)) byPhone9.set(suf, p);
      const em = (p.contact_email || '').toLowerCase().trim();
      if (em && !byEmail.has(em)) byEmail.set(em, p);
    }
    return { byPhone9, byEmail };
  }, [propostas]);

  const results = useMemo<MatchResult[]>(() => {
    return rows.map(r => {
      const phone9 = onlyDigits(r.telefone).slice(-9);
      const email = (r.email || '').toLowerCase().trim();

      let p: Proposal | null = null;
      let q: MatchQuality = 'none';

      if (phone9 && indexes.byPhone9.has(phone9)) {
        p = indexes.byPhone9.get(phone9)!;
        q = 'phone';
      } else if (email && indexes.byEmail.has(email)) {
        p = indexes.byEmail.get(email)!;
        q = 'email';
      } else if (r.nome) {
        // fuzzy fallback by name
        let best: { p: Proposal; s: number } | null = null;
        for (const cand of propostas) {
          const s = nameScore(r.nome, cand.contact_name || cand.deal_name || '');
          if (s >= 0.6 && (!best || s > best.s)) best = { p: cand, s };
        }
        if (best) {
          p = best.p;
          q = 'name';
        }
      }

      let suggestions: Proposal[] | undefined;
      if (!p && r.nome) {
        suggestions = propostas
          .map(cand => ({ cand, s: nameScore(r.nome, cand.contact_name || cand.deal_name || '') }))
          .filter(x => x.s >= 0.3)
          .sort((a, b) => b.s - a.s)
          .slice(0, 3)
          .map(x => x.cand);
      }

      return { ...r, proposal: p, quality: q, suggestions };
    });
  }, [rows, propostas, indexes]);

  const filtered = useMemo(() => {
    if (filter === 'matched') return results.filter(r => r.proposal);
    if (filter === 'unmatched') return results.filter(r => !r.proposal);
    return results;
  }, [results, filter]);

  const stats = useMemo(() => {
    const total = results.length;
    const matched = results.filter(r => r.proposal).length;
    return { total, matched, unmatched: total - matched };
  }, [results]);

  async function handleUpload(file: File) {
    try {
      const XLSX = await loadXLSX();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });
      const parsed: UploadRow[] = json.map(r => {
        const findKey = (keys: string[]) => {
          const k = Object.keys(r).find(kk => keys.some(x => kk.toLowerCase().trim() === x));
          return k ? r[k] : null;
        };
        const nome = findKey(['nome', 'name', 'contato']) ?? '';
        const email = findKey(['email', 'e-mail']) ?? '';
        const telefone = findKey(['telefone', 'phone', 'celular', 'whatsapp']) ?? '';
        return {
          nome: String(nome || '').trim(),
          email: String(email || '').trim(),
          telefone: String(telefone || '').trim(),
        };
      }).filter(r => r.nome || r.email || r.telefone);
      if (!parsed.length) {
        toast.error('Planilha vazia ou sem colunas Nome/Email/Telefone.');
        return;
      }
      setRows(parsed);
      setFileName(file.name);
      toast.success(`${parsed.length} contatos carregados.`);
    } catch (e: any) {
      toast.error('Erro ao ler planilha: ' + (e?.message || e));
    }
  }

  async function handleUploadAndSave(file: File) {
    try {
      const XLSX = await loadXLSX();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });
      const parsed: UploadRow[] = json.map(r => {
        const findKey = (keys: string[]) => {
          const k = Object.keys(r).find(kk => keys.some(x => kk.toLowerCase().trim() === x));
          return k ? r[k] : null;
        };
        const nome = findKey(['nome', 'name', 'contato']) ?? '';
        const email = findKey(['email', 'e-mail']) ?? '';
        const telefone = findKey(['telefone', 'phone', 'celular', 'whatsapp']) ?? '';
        return {
          nome: String(nome || '').trim(),
          email: String(email || '').trim(),
          telefone: String(telefone || '').trim(),
        };
      }).filter(r => r.nome || r.email || r.telefone);
      if (!parsed.length) {
        toast.error('Planilha vazia ou sem colunas Nome/Email/Telefone.');
        return;
      }
      setRows(parsed);
      setFileName(file.name);
      await saveUpload.mutateAsync({ fileName: file.name, parsed });
    } catch (e: any) {
      toast.error('Erro ao ler planilha: ' + (e?.message || e));
    }
  }

  async function exportResults() {
    const XLSX = await loadXLSX();
    const data = results.map(r => ({
      'Nome (planilha)': r.nome,
      'Email (planilha)': r.email,
      'Telefone (planilha)': r.telefone,
      'Match': r.proposal ? 'Sim' : 'Não',
      'Critério': r.quality === 'phone' ? 'Telefone' : r.quality === 'email' ? 'Email' : r.quality === 'name' ? 'Nome (sugestão)' : '',
      'Contato CRM': r.proposal?.contact_name || r.proposal?.deal_name || '',
      'Email CRM': r.proposal?.contact_email || '',
      'Telefone CRM': r.proposal?.contact_phone || '',
      'Status proposta': r.proposal?.status || '',
      'Closer': r.proposal?.closer_name || '',
      'Cota cadastrada': r.proposal?.consortium_card_id ? 'Sim' : 'Não',
      'Documentos pendentes': r.proposal?.documentos_pendentes ? 'Sim' : 'Não',
      'Sugestões (nome)': !r.proposal && r.suggestions?.length
        ? r.suggestions.map(s => s.contact_name || s.deal_name).filter(Boolean).join(' | ')
        : '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Match');
    XLSX.writeFile(wb, `match-socio-parceiro-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Match sócio-parceiro no CRM Consórcio</CardTitle>
        <p className="text-xs text-muted-foreground">
          Carregue uma planilha com colunas <strong>Nome</strong>, <strong>Email</strong> e <strong>Telefone</strong>.
          O sistema cruza com as propostas do CRM (telefone → email → sugestão por nome) e dá acesso direto ao checklist e documentos anexados.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleUploadAndSave(f);
                e.currentTarget.value = '';
              }}
            />
            <Button asChild size="sm">
              <span><Upload className="h-4 w-4 mr-1" /> Carregar planilha</span>
            </Button>
          </label>
          {fileName && (
            <span className="text-xs text-muted-foreground">
              <FileText className="h-3 w-3 inline mr-1" />
              {fileName}
              {uploadMeta && (
                <span className="ml-2">
                  · enviado por <strong>{uploadMeta.uploaded_by_name || '—'}</strong> em{' '}
                  {format(new Date(uploadMeta.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              )}
            </span>
          )}
          {rows.length > 0 && (
            <>
              <Button size="sm" variant="ghost" onClick={() => { setRows([]); setFileName(''); setUploadMeta(null); }}>
                <Trash2 className="h-4 w-4 mr-1" /> Limpar (local)
              </Button>
              <Button size="sm" variant="outline" onClick={exportResults}>
                <Download className="h-4 w-4 mr-1" /> Exportar resultado
              </Button>
              <div className="ml-auto flex items-center gap-2 text-xs">
                <Badge variant="secondary">{stats.total} contatos</Badge>
                <Badge className="bg-emerald-100 text-emerald-700">{stats.matched} match</Badge>
                <Badge className="bg-amber-100 text-amber-800">{stats.unmatched} sem match</Badge>
                <div className="flex rounded border overflow-hidden">
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-2 py-1 ${filter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
                  >Todos</button>
                  <button
                    onClick={() => setFilter('matched')}
                    className={`px-2 py-1 border-l ${filter === 'matched' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
                  >Match</button>
                  <button
                    onClick={() => setFilter('unmatched')}
                    className={`px-2 py-1 border-l ${filter === 'unmatched' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
                  >Sem match</button>
                </div>
              </div>
            </>
          )}
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Carregando propostas do CRM…</p>}

        {rows.length === 0 ? (
          <div className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhuma planilha carregada. Aceita colunas: Nome, Email, Telefone (a ordem não importa).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome (planilha)</TableHead>
                  <TableHead>Email / Telefone</TableHead>
                  <TableHead>Match no CRM</TableHead>
                  <TableHead>Critério</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Closer</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.nome || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.email || '—'}<br />{r.telefone || '—'}
                    </TableCell>
                    <TableCell>
                      {r.proposal ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{r.proposal.contact_name || r.proposal.deal_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {r.proposal.contact_email || ''} {r.proposal.contact_phone ? `· ${r.proposal.contact_phone}` : ''}
                          </span>
                        </div>
                      ) : r.suggestions && r.suggestions.length > 0 ? (
                        <div className="text-xs text-muted-foreground">
                          <div className="flex items-center gap-1 text-amber-700 mb-1">
                            <AlertTriangle className="h-3 w-3" /> Sugestões:
                          </div>
                          {r.suggestions.map(s => (
                            <button
                              key={s.id}
                              className="block text-left hover:underline text-primary"
                              onClick={() => setViewTarget(s)}
                            >
                              • {s.contact_name || s.deal_name}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.quality === 'phone' && <Badge className="bg-emerald-100 text-emerald-700 text-xs">Telefone</Badge>}
                      {r.quality === 'email' && <Badge className="bg-blue-100 text-blue-700 text-xs">Email</Badge>}
                      {r.quality === 'name' && <Badge className="bg-amber-100 text-amber-800 text-xs">Nome (fuzzy)</Badge>}
                      {r.quality === 'none' && <Badge variant="outline" className="text-xs">Sem match</Badge>}
                    </TableCell>
                    <TableCell>
                      {r.proposal ? (
                        <div className="flex flex-col gap-1">
                          <Badge variant={r.proposal.status === 'aceita' ? 'default' : 'outline'} className="text-xs capitalize w-fit">
                            {r.proposal.status}
                          </Badge>
                          {r.proposal.documentos_pendentes && (
                            <Badge variant="destructive" className="text-xs w-fit">Doc pendente</Badge>
                          )}
                          {r.proposal.consortium_card_id && (
                            <Badge className="bg-primary/10 text-primary text-xs w-fit">Cota cadastrada</Badge>
                          )}
                        </div>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-sm">{r.proposal?.closer_name || '—'}</TableCell>
                    <TableCell className="text-right">
                      {r.proposal ? (
                        <Button size="sm" variant="outline" onClick={() => setViewTarget(r.proposal!)}>
                          <FileText className="h-3 w-3 mr-1" /> Ver Dados
                        </Button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <XCircle className="h-3 w-3" /> —
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                      Nenhum registro para este filtro.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {viewTarget && (
          <ViewRegistrationDialog
            open={!!viewTarget}
            onOpenChange={o => !o && setViewTarget(null)}
            proposalId={viewTarget.id}
            consortiumCardId={viewTarget.consortium_card_id}
            contactName={viewTarget.contact_name || viewTarget.deal_name}
          />
        )}
      </CardContent>
    </Card>
  );
}

// silence unused import warnings for icons kept for future affordances
void CheckCircle2;