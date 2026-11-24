import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, ShieldCheck, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export type DocTipo = 'requisicao' | 'desligamento';
export type Etapa = { id: string; ordem: number; papel: string; status: string; prazo: string | null; aprovador: string | null; decidido_nome: string | null; decidido_cargo: string | null; decidido_setor: string | null; comentario: string | null; metodo: string | null; ip: string | null; user_agent: string | null; hash: string | null; decidido_em: string | null; minha_vez: boolean };
export type Versao = { versao: number; hash: string; status: string; criada_em: string; encerrada_em: string | null; snapshot: Record<string, unknown>; etapas: Etapa[] };

export const STATUS_ETAPA: Record<string, string> = { pendente: 'Pendente', aprovada: 'Aprovada', reprovada: 'Reprovada', devolvida: 'Devolvida', invalidada: 'Invalidada' };
const fmt = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');

export function useTrilha(tipo: DocTipo, id: string | undefined) {
  return useQuery({
    queryKey: ['gov-trilha', tipo, id], enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('gov_assinatura_trilha' as never, { p_tipo: tipo, p_id: id } as never);
      if (error) throw error;
      return (data ?? []) as unknown as Versao[];
    },
  });
}

export function AssinaturaTrilha({ tipo, id, onDecidido }: { tipo: DocTipo; id: string; onDecidido?: () => void }) {
  const q = useTrilha(tipo, id);
  const [etapa, setEtapa] = useState<Etapa | null>(null);
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Carregando assinaturas…</p>;
  if (q.error) return null;
  const atual = q.data?.[0];
  if (!atual) return null;
  return <section className="space-y-3 rounded-lg border p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" /> Assinaturas — versão {atual.versao}</h2>
      <Button variant="outline" size="sm" asChild><Link to={`/governanca/verificacao/${tipo}/${id}`}><ExternalLink className="mr-1 h-3 w-3" /> Verificação</Link></Button>
    </div>
    <p className="break-all font-mono text-xs text-muted-foreground">Código: {atual.hash}</p>
    <ol className="space-y-2">{atual.etapas.map(e => <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 rounded border p-2 text-sm">
      <div><div className="font-medium">{e.ordem}. {e.papel}</div><div className="text-muted-foreground">{e.decidido_nome ?? e.aprovador ?? '—'}{e.decidido_em ? ` · ${fmt(e.decidido_em)}` : e.status === 'pendente' && e.prazo ? ` · prazo ${fmt(e.prazo)}` : ''}</div>{e.comentario && <div className="mt-1 italic">“{e.comentario}”</div>}</div>
      <div className="flex items-center gap-2"><Badge variant={e.status === 'reprovada' ? 'destructive' : e.status === 'aprovada' ? 'default' : 'outline'}>{STATUS_ETAPA[e.status] ?? e.status}</Badge>{e.minha_vez && <Button size="sm" onClick={() => setEtapa(e)}>Decidir</Button>}</div>
    </li>)}</ol>
    {q.data!.length > 1 && <p className="text-xs text-muted-foreground">{q.data!.length - 1} versão(ões) anterior(es) no histórico.</p>}
    <DecisaoDialog etapa={etapa} hash={atual.hash} onClose={() => setEtapa(null)} onDone={() => { setEtapa(null); void q.refetch(); onDecidido?.(); }} />
  </section>;
}

export function DecisaoDialog({ etapa, hash, onClose, onDone }: { etapa: { id: string; papel: string } | null; hash: string; onClose: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const google = ((user?.app_metadata?.providers as string[] | undefined) ?? [user?.app_metadata?.provider]).includes('google');
  const [decisao, setDecisao] = useState<'aprovada' | 'reprovada' | 'devolvida'>('aprovada');
  const [comentario, setComentario] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmo, setConfirmo] = useState(false);
  const [busy, setBusy] = useState(false);
  const reset = () => { setDecisao('aprovada'); setComentario(''); setSenha(''); setConfirmo(false); };
  const precisaComentario = decisao !== 'aprovada';
  const pode = confirmo && (!precisaComentario || comentario.trim()) && (google || senha);
  const enviar = async () => {
    if (!etapa) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('gov-assinar', { body: { etapa_id: etapa.id, decisao, comentario, confirmo: true, ...(senha ? { senha } : {}) } });
    setBusy(false);
    const msg = (data as { error?: string } | null)?.error;
    if (error || msg) {
      let texto = msg;
      try { texto = texto ?? (await (error as { context?: Response }).context?.json())?.error; } catch { /* ignore */ }
      toast.error(texto ?? 'Não foi possível registrar a decisão'); return;
    }
    toast.success(decisao === 'aprovada' ? 'Aprovado e assinado' : decisao === 'reprovada' ? 'Reprovado' : 'Devolvido ao solicitante');
    void qc.invalidateQueries({ queryKey: ['gov-minhas-aprovacoes'] });
    reset(); onDone();
  };
  return <Dialog open={!!etapa} onOpenChange={o => { if (!o && !busy) { reset(); onClose(); } }}><DialogContent>
    <DialogHeader><DialogTitle>Decisão — {etapa?.papel}</DialogTitle><DialogDescription className="break-all">Documento com código {hash.slice(0, 16)}…</DialogDescription></DialogHeader>
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">{(['aprovada', 'devolvida', 'reprovada'] as const).map(d => <Button key={d} type="button" variant={decisao === d ? (d === 'reprovada' ? 'destructive' : 'default') : 'outline'} onClick={() => setDecisao(d)}>{d === 'aprovada' ? 'Aprovar e assinar' : d === 'devolvida' ? 'Devolver' : 'Reprovar'}</Button>)}</div>
      <div className="space-y-1"><Label htmlFor="gov-coment">Comentário{precisaComentario ? ' (obrigatório)' : ' (opcional)'}</Label><Textarea id="gov-coment" value={comentario} onChange={e => setComentario(e.target.value)} /></div>
      {google ? <Alert><AlertDescription>Sua assinatura será validada pela sua conta Google conectada. Se preferir, digite sua senha do sistema abaixo.</AlertDescription></Alert> : null}
      <div className="space-y-1"><Label htmlFor="gov-senha">Senha do sistema{google ? ' (opcional)' : ''}</Label><Input id="gov-senha" type="password" autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} /></div>
      <label className="flex items-start gap-2 text-sm"><Checkbox checked={confirmo} onCheckedChange={v => setConfirmo(v === true)} /> Li o documento e confirmo esta decisão, que será registrada com meu nome, cargo, horário, IP e navegador.</label>
    </div>
    <DialogFooter><Button variant="outline" disabled={busy} onClick={() => { reset(); onClose(); }}>Cancelar</Button><Button disabled={!pode || busy} onClick={enviar}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Confirmar</Button></DialogFooter>
  </DialogContent></Dialog>;
}
