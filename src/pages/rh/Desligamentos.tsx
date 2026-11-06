import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Save, Send, ShieldCheck, Loader2, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { TIPOS_DESLIGAMENTO, validarEnvioDesligamento, podeRemoverSignatario, type TipoDesligamento, type Remocao } from '@/lib/desligamento';
import { TIPOS_DOSSIE } from '@/lib/dossie';
import type { RegistroDossie } from '@/hooks/useDossie';

type Signatario = { chave: string; nome: string; papel: string; obrigatorio?: boolean; substituto?: boolean };
type Pessoa = { id: string; nome: string; departamento_id?: string };
type Contexto = { pessoas: Pessoa[]; candidatos: Pessoa[]; signatarios: Signatario[]; registros: RegistroDossie[]; sem_evidencia_recente: boolean };
type Ficha = { id?: string; employee_id: string; solicitante_user_id?: string; tipo: TipoDesligamento; motivo: string; descricao: string; data_prevista: string | null; justificativa: string; justificativa_reforcada: string; evidencias: string[]; feedbacks_construtivos: string[]; extras: string[]; signatarios: Signatario[]; remocoes: Remocao[]; sem_evidencia_recente: boolean; status: string; created_at?: string };
const nova = (id = ''): Ficha => ({ employee_id: id, tipo: 'sem_justa_causa', motivo: '', descricao: '', data_prevista: null, justificativa: '', justificativa_reforcada: '', evidencias: [], feedbacks_construtivos: [], extras: [], signatarios: [], remocoes: [], sem_evidencia_recente: true, status: 'rascunho' });
const dia = (s?: string | null) => s ? (s.length === 10 ? `${s.slice(8,10)}/${s.slice(5,7)}/${s.slice(0,4)}` : new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })) : '—';
const motivos = ['Desempenho', 'Conduta', 'Reestruturação', 'Término contratual', 'Iniciativa do colaborador', 'Outro'];

export default function Desligamentos() {
  const { user, allRoles } = useAuth();
  const rh = allRoles.some(r => r === 'admin' || r === 'rh');
  const podeCriar = rh || allRoles.some(r => r === 'manager' || r === 'coordenador');
  const [params] = useSearchParams();
  const [edit, setEdit] = useState<Ficha | null>(() => params.get('employee') && podeCriar ? nova(params.get('employee') ?? '') : null);
  const [busy, setBusy] = useState(false);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('todos');
  const [remover, setRemover] = useState('');
  const [justRemover, setJustRemover] = useState('');
  const qc = useQueryClient();
  const lista = useQuery({ queryKey: ['gov-desligamentos'], queryFn: async () => {
    const rows: Ficha[] = [];
    for (let i = 0; ; i += 1000) {
      const r = await supabase.from('gov_desligamentos').select('*').order('created_at', { ascending: false }).order('id').range(i,i+999);
      if (r.error) throw r.error;
      rows.push(...r.data as unknown as Ficha[]); if (r.data.length < 1000) return rows;
    }
  } });
  const base = useQuery({ queryKey: ['gov-desligamentos-base'], enabled: podeCriar, queryFn: async () => {
    const r = await supabase.rpc('gov_desligamento_contexto'); if (r.error) throw r.error; return r.data as unknown as Contexto;
  } });
  const ctx = useQuery({ queryKey: ['gov-desligamento-contexto', edit?.employee_id, edit?.tipo], enabled: !!edit?.employee_id && podeCriar, queryFn: async () => {
    const r = await supabase.rpc('gov_desligamento_contexto', { p_employee: edit?.employee_id, p_tipo: edit?.tipo }); if (r.error) throw r.error; return r.data as unknown as Contexto;
  } });
  const editable = !!edit && edit.status === 'rascunho' && (rh || !edit.id || edit.solicitante_user_id === user?.id);
  const detalhe = useQuery({ queryKey: ['gov-desligamento-detalhe', edit?.id, edit?.tipo], enabled: !!edit?.id, queryFn: async () => {
    if (!edit?.id) return null;
    const r = await supabase.rpc('gov_desligamento_detalhe', { p_id: edit.id }); if (r.error) throw r.error;
    return r.data as unknown as { nome: string; registros: RegistroDossie[]; signatarios: Signatario[] };
  } });
  const patch = (p: Partial<Ficha>) => setEdit(e => e ? { ...e, ...p } : e);
  const signatarios = edit?.id ? (edit.status === 'rascunho' ? detalhe.data?.signatarios ?? edit.signatarios : edit.signatarios) : ctx.data?.signatarios ?? [];
  const registros = ctx.data?.registros ?? detalhe.data?.registros ?? [];
  const semEvidencia = (ctx.data?.sem_evidencia_recente ?? edit?.sem_evidencia_recente ?? true) && !registros.some(r => r.tipo === 'feedback' && edit?.feedbacks_construtivos?.includes(r.id) && Date.parse(r.ocorrido_em) <= Date.now() && Date.parse(r.ocorrido_em) >= new Date(new Date().setMonth(new Date().getMonth()-6)).getTime());
  const salvar = async (enviar = false) => {
    if (!edit || busy || !editable || !ctx.data) return;
    if (enviar) { const erro = validarEnvioDesligamento({ ...edit, sem_evidencia_recente: semEvidencia }); if (erro) { toast.error(erro); return; } }
    setBusy(true);
    try {
      const r = await supabase.rpc('gov_desligamento_salvar', { p_dados: { ...edit, status: enviar ? 'em_aprovacao' : 'rascunho' } });
      if (r.error) throw r.error; setEdit(r.data as unknown as Ficha); toast.success(enviar ? 'Solicitação enviada' : 'Rascunho salvo');
      await Promise.all([qc.invalidateQueries({ queryKey: ['gov-desligamentos'] }),qc.invalidateQueries({ queryKey: ['gov-desligamento-detalhe'] })]);
    } catch (e) { toast.error((e as Error).message || 'Não foi possível salvar'); } finally { setBusy(false); }
  };
  const validarRemocao = async (chave: string) => {
    if (!edit?.id || busy) return; setBusy(true);
    try {
      const r = await supabase.rpc('gov_desligamento_validar_remocao', { p_id: edit.id, p_chave: chave }); if (r.error) throw r.error;
      const updated = await supabase.from('gov_desligamentos').select('*').eq('id',edit.id).single(); if (updated.error) throw updated.error;
      setEdit(updated.data as unknown as Ficha); await Promise.all([qc.invalidateQueries({ queryKey: ['gov-desligamentos'] }),qc.invalidateQueries({ queryKey: ['gov-desligamento-detalhe'] })]); toast.success('Remoção validada pelo RH');
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const campo = (key: 'descricao' | 'justificativa' | 'justificativa_reforcada', label: string) => <div className="space-y-2"><Label htmlFor={key}>{label}</Label><Textarea id={key} rows={4} disabled={!editable || busy} value={edit?.[key] ?? ''} onChange={e => patch({ [key]: e.target.value })} /></div>;
  const rows = (lista.data ?? []).filter(r => (status === 'todos' || r.status === status) && `${base.data?.pessoas.find(p => p.id === r.employee_id)?.nome ?? ''} ${r.motivo}`.toLowerCase().includes(busca.toLowerCase()));
  return <div className="space-y-6 p-4 sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-bold">Desligamentos</h1>{podeCriar && <Button disabled={base.isLoading || !!base.error} onClick={() => setEdit(nova())}><Plus className="mr-2 h-4 w-4" />Solicitar desligamento</Button>}</header>
    {(lista.error || base.error) && <Alert variant="destructive"><AlertDescription>{(lista.error || base.error)?.message}<Button variant="outline" onClick={() => { void lista.refetch(); void base.refetch(); }}>Tentar novamente</Button></AlertDescription></Alert>}
    <div className="flex flex-wrap gap-3"><Input className="max-w-sm" aria-label="Buscar colaborador ou motivo" placeholder="Buscar colaborador ou motivo" value={busca} onChange={e => setBusca(e.target.value)} /><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-48" aria-label="Filtrar status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os status</SelectItem><SelectItem value="rascunho">Rascunho</SelectItem><SelectItem value="em_aprovacao">Em aprovação</SelectItem></SelectContent></Select></div>
    <Table><TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead>Tipo</TableHead><TableHead>Data prevista</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{rows.map(r => <TableRow key={r.id} role="button" tabIndex={0} className="cursor-pointer" onClick={() => setEdit(r)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEdit(r); } }}><TableCell>{base.data?.pessoas.find(p => p.id === r.employee_id)?.nome ?? 'Colaborador'}</TableCell><TableCell>{TIPOS_DESLIGAMENTO[r.tipo]}</TableCell><TableCell>{dia(r.data_prevista)}</TableCell><TableCell><Badge variant="outline">{r.status === 'rascunho' ? 'Rascunho' : 'Em aprovação'}</Badge></TableCell></TableRow>)}{!rows.length && <TableRow><TableCell colSpan={4} className="py-12 text-center text-muted-foreground">{lista.isLoading ? 'Carregando…' : 'Nenhuma solicitação encontrada'}</TableCell></TableRow>}</TableBody></Table>
    <Sheet open={!!edit} onOpenChange={o => { if (!o && !busy) setEdit(null); }}><SheetContent className="w-full overflow-y-auto sm:max-w-[900px]"><SheetHeader><SheetTitle>Solicitação de desligamento</SheetTitle><SheetDescription>{edit?.status === 'rascunho' ? 'Rascunho' : 'Em aprovação'} · Confidencial</SheetDescription></SheetHeader>
      {edit && <div className="space-y-6 py-6">
        {edit.status !== 'rascunho' && <Alert><AlertDescription>Solicitação congelada. Assinaturas e decisões aguardam a Fase 5.</AlertDescription></Alert>}
        {(ctx.error || detalhe.error) && <Alert variant="destructive"><AlertDescription>{(ctx.error || detalhe.error)?.message}</AlertDescription></Alert>}
        {detalhe.data?.nome && <p className="font-semibold">{detalhe.data.nome}</p>}
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Colaborador</Label><Select value={edit.employee_id || '__none'} disabled={!editable || !!edit.id || busy} onValueChange={id => { setEdit(nova(id)); }}><SelectTrigger aria-label="Colaborador"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none" disabled>Selecionar</SelectItem>{base.data?.pessoas.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Tipo de desligamento</Label><Select value={edit.tipo} disabled={!editable || busy} onValueChange={v => patch({ tipo: v as TipoDesligamento })}><SelectTrigger aria-label="Tipo de desligamento"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TIPOS_DESLIGAMENTO).map(([id,nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Motivo</Label><Select value={edit.motivo || '__none'} disabled={!editable || busy} onValueChange={motivo => patch({ motivo })}><SelectTrigger aria-label="Motivo"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none" disabled>Selecionar</SelectItem>{motivos.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="data-prevista">Data prevista</Label><Input id="data-prevista" type="date" value={edit.data_prevista ?? ''} disabled={!editable || busy} onChange={e => patch({ data_prevista: e.target.value || null })} /></div>
        </div>{campo('descricao','Descrição do motivo')}{campo('justificativa','Justificativa')}
        {edit.employee_id && semEvidencia && <><Alert><AlertDescription>Sem flags ou feedbacks construtivos confirmados nos últimos 6 meses. Inclua a justificativa reforçada.</AlertDescription></Alert>{campo('justificativa_reforcada','Justificativa reforçada')}</>}
        <section className="space-y-4 border-t pt-5"><h2 className="font-semibold">Evidências do dossiê</h2>{ctx.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : registros.map(r => <div key={r.id} className="space-y-2 border-b pb-4"><label className="flex items-start gap-3"><Checkbox className="mt-1" disabled={!editable || busy} checked={edit.evidencias.includes(r.id)} onCheckedChange={v => patch({ evidencias: v ? [...edit.evidencias,r.id] : edit.evidencias.filter(id => id !== r.id) })} /><span className="min-w-0 space-y-1"><span className="block text-xs text-muted-foreground">{dia(r.ocorrido_em)} · {TIPOS_DOSSIE[r.tipo]}</span><span className="block font-medium">{r.titulo}</span><span className="block whitespace-pre-wrap break-words text-sm">{r.conteudo}</span></span></label>{r.tipo === 'feedback' && <label className="flex items-center gap-2 text-sm"><Checkbox disabled={!editable || busy} checked={edit.feedbacks_construtivos?.includes(r.id) ?? false} onCheckedChange={v => patch({ feedbacks_construtivos: v ? [...(edit.feedbacks_construtivos ?? []),r.id] : (edit.feedbacks_construtivos ?? []).filter(id => id !== r.id) })} />Confirmo que este feedback é construtivo</label>}</div>)}{!!edit.employee_id && !registros.length && !ctx.isLoading && <p className="text-sm text-muted-foreground">Nenhum registro no dossiê</p>}</section>
        <section className="space-y-4 border-t pt-5"><h2 className="font-semibold">Signatários sugeridos</h2>{signatarios.map(s => <div key={s.chave} className="flex flex-wrap items-center justify-between gap-2 border-b pb-3"><div><p className="font-medium">{s.nome}{s.substituto && <Badge variant="secondary" className="ml-2">Substituto</Badge>}</p><p className="text-sm text-muted-foreground">{s.papel}{s.obrigatorio ? ' · obrigatório' : ''}</p></div>{editable && podeRemoverSignatario(s) && !edit.remocoes.some(r => r.chave === s.chave) && <Button size="sm" variant="ghost" title="Solicitar remoção" onClick={() => { setRemover(s.chave); setJustRemover(''); }}><UserMinus className="mr-2 h-4 w-4" />Remover</Button>}</div>)}
          {remover && editable && <div className="space-y-2"><Label htmlFor="just-remocao">Justificativa da remoção</Label><Textarea id="just-remocao" value={justRemover} onChange={e => setJustRemover(e.target.value)} /><Button variant="outline" disabled={!justRemover.trim()} onClick={() => { patch({ remocoes: [...edit.remocoes,{ chave: remover, justificativa: justRemover.trim() }] }); setRemover(''); }}>Solicitar validação do RH</Button></div>}
          {edit.remocoes.map(r => <div key={r.chave} className="space-y-2"><p className="text-sm">{r.justificativa}</p><Badge variant="outline">{r.validada_por ? 'Remoção validada' : 'Validação do RH pendente'}</Badge>{rh && editable && edit.id && !r.validada_por && <Button size="sm" variant="outline" disabled={busy} onClick={() => void validarRemocao(r.chave)}><ShieldCheck className="mr-2 h-4 w-4" />Validar remoção salva</Button>}</div>)}
          {editable && <div className="space-y-2"><Label>Adicionar signatário</Label><Select value="__none" disabled={busy} onValueChange={id => { if (!edit.extras.includes(id)) patch({ extras: [...edit.extras,id] }); }}><SelectTrigger aria-label="Adicionar signatário"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none">Selecionar</SelectItem>{ctx.data?.candidatos.filter(p => !edit.extras.includes(p.id)).map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent></Select>{edit.extras.map(id => <p key={id} className="text-sm">{ctx.data?.candidatos.find(p => p.id === id)?.nome ?? id} · adicional</p>)}</div>}
        </section>{editable && <div className="flex flex-wrap gap-3 border-t pt-5"><Button variant="outline" disabled={busy || !ctx.data || ctx.isFetching} onClick={() => void salvar()}><Save className="mr-2 h-4 w-4" />Salvar rascunho</Button><Button disabled={busy || !ctx.data || ctx.isFetching} onClick={() => void salvar(true)}><Send className="mr-2 h-4 w-4" />Enviar para aprovação</Button></div>}
      </div>}
    </SheetContent></Sheet>
  </div>;
}