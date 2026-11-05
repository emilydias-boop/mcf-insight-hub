import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Save, Send, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { STATUS_REQUISICAO, exigeJustificativa, type RequisicaoStatus } from '@/lib/requisicaoContratacao';

type Req = {
  id?: string; solicitante_user_id?: string; titulo: string; departamento_id: string | null; cargo_catalogo_id: string | null;
  centro_custo: string; tipo: string; substituido_employee_id: string | null; quantidade: number;
  missao: string; responsabilidades: string; requisitos_obrigatorios: string; requisitos_desejaveis: string;
  competencias: string; indicadores: string; regime: string; salario_base: number; variavel: string; beneficios: string;
  modelo_trabalho: string; local: string; data_inicio: string | null; justificativa: string; status: RequisicaoStatus;
  contratado_employee_id: string | null; created_at?: string; atores_previstos?: { papel: string; employee_id?: string; role?: string }[];
};
type Cargo = { id: string; nome_exibicao: string; departamento_id: string | null; faixa_salarial_min: number | null; faixa_salarial_max: number | null };
type Pessoa = { id: string; nome: string };
type Alcada = { cond_aumento_quadro: boolean | null; cond_salario_acima: number | null; cond_departamento_id: string | null; exige_justificativa: boolean };
const vazio = (): Req => ({ titulo: '', departamento_id: null, cargo_catalogo_id: null, centro_custo: '', tipo: 'aumento_quadro', substituido_employee_id: null, quantidade: 1, missao: '', responsabilidades: '', requisitos_obrigatorios: '', requisitos_desejaveis: '', competencias: '', indicadores: '', regime: 'CLT', salario_base: 0, variavel: '', beneficios: '', modelo_trabalho: 'presencial', local: '', data_inicio: null, justificativa: '', status: 'rascunho', contratado_employee_id: null });
const moeda = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dia = (d?: string) => d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';
function Escolha({ label, value, options, disabled, onChange }: { label: string; value: string | null; options: { id: string; nome: string }[]; disabled?: boolean; onChange: (s: string | null) => void }) {
  return <div className="space-y-2"><Label>{label}</Label><Select value={value || '__none'} onValueChange={s => onChange(s === '__none' ? null : s)} disabled={disabled}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none">Selecionar</SelectItem>{options.map(o => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}</SelectContent></Select></div>;
}

export default function Requisicoes() {
  const { user, allRoles } = useAuth();
  const rh = allRoles.some(r => r === 'admin' || r === 'rh');
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Req | null>(null);
  const [busy, setBusy] = useState(false);
  const [filtros, setFiltros] = useState({ status: 'todos', setor: 'todos', regime: 'todos', busca: '' });
  const lista = useQuery({ queryKey: ['gov-requisicoes'], queryFn: async () => {
    const result: Req[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from('gov_requisicoes_contratacao').select('*').order('created_at', { ascending: false }).order('id').range(offset, offset + 999);
      if (error) throw error;
      result.push(...data as unknown as Req[]);
      if (data.length < 1000) break;
    }
    return result;
  } });
  const base = useQuery({ queryKey: ['gov-requisicoes-base'], queryFn: async () => {
    const [d, c, p, a] = await Promise.all([
      supabase.from('departamentos').select('id,nome').eq('ativo', true).order('nome'),
      supabase.from('cargos_catalogo').select('id,nome_exibicao,departamento_id,faixa_salarial_min,faixa_salarial_max').eq('ativo', true).order('nome_exibicao'),
      supabase.rpc('gov_requisicao_opcoes'),
      supabase.from('gov_alcadas').select('cond_aumento_quadro,cond_salario_acima,cond_departamento_id,exige_justificativa').eq('ativo', true).in('aplica_em', ['contratacao', 'ambos']),
    ]);
    for (const result of [d, c, p, a]) if (result.error) throw result.error;
    return { deps: d.data ?? [], cargos: (c.data ?? []) as Cargo[], pessoas: (p.data as unknown as { pessoas: Pessoa[] })?.pessoas ?? [], alcadas: (a.data ?? []) as Alcada[] };
  } });
  const editable = !!edit && ['rascunho', 'devolvida'].includes(edit.status) && (rh || !edit.id || edit.solicitante_user_id === user?.id);
  const podeAcao = !!edit && (rh || !edit.id || edit.solicitante_user_id === user?.id);
  const cargo = base.data?.cargos.find(c => c.id === edit?.cargo_catalogo_id);
  const alcada = base.data?.alcadas.some(a => a.exige_justificativa && (a.cond_aumento_quadro === null || a.cond_aumento_quadro === (edit?.tipo === 'aumento_quadro')) && (a.cond_salario_acima === null || (edit?.salario_base ?? 0) > a.cond_salario_acima) && (a.cond_departamento_id === null || a.cond_departamento_id === edit?.departamento_id)) ?? false;
  const obrigatoria = edit ? exigeJustificativa(edit.tipo, edit.salario_base, cargo?.faixa_salarial_min ?? null, cargo?.faixa_salarial_max ?? null, alcada) : false;
  const patch = (p: Partial<Req>) => setEdit(r => r ? { ...r, ...p } : r);
  const salvar = async (status?: RequisicaoStatus) => {
    if (!edit || busy) return;
    if (status === 'em_aprovacao' && obrigatoria && !edit.justificativa.trim()) { toast.error('Justificativa obrigatória'); return; }
    if (status === 'cancelada' && !window.confirm('Cancelar esta requisição?')) return;
    setBusy(true);
    try {
      const { id, solicitante_user_id, created_at, atores_previstos, ...campos } = edit;
      if (!id && status) {
        const { data, error } = await supabase.from('gov_requisicoes_contratacao').insert({ ...campos, status: 'rascunho' }).select('*').single();
        if (error) throw error;
        setEdit(data as unknown as Req);
        const next = await supabase.from('gov_requisicoes_contratacao').update({ status }).eq('id', data.id).select('*').single();
        if (next.error) throw next.error;
        setEdit(next.data as unknown as Req);
      } else {
        const payload = editable ? { ...campos, status: status ?? campos.status } : { status: status ?? campos.status, contratado_employee_id: campos.contratado_employee_id };
        const result = id ? await supabase.from('gov_requisicoes_contratacao').update(payload).eq('id', id).select('*').single() : await supabase.from('gov_requisicoes_contratacao').insert(payload).select('*').single();
        if (result.error) throw result.error;
        setEdit(result.data as unknown as Req);
      }
      toast.success(status === 'em_aprovacao' ? 'Requisição enviada para aprovação' : 'Requisição salva');
    } catch (e) { toast.error((e as { message?: string }).message || 'Não foi possível salvar'); }
    finally { setBusy(false); await qc.invalidateQueries({ queryKey: ['gov-requisicoes'] }); }
  };
  const texto = (key: keyof Req, label: string, area = false) => <div className="space-y-2" key={key}><Label htmlFor={key}>{label}</Label>{area ? <Textarea id={key} rows={4} value={String(edit?.[key] ?? '')} disabled={!editable || busy} onChange={e => patch({ [key]: e.target.value })} /> : <Input id={key} value={String(edit?.[key] ?? '')} disabled={!editable || busy} onChange={e => patch({ [key]: e.target.value })} />}</div>;
  const options = (items: string[]) => items.map(s => ({ id: s, nome: s }));
  const rows = (lista.data ?? []).filter(r => (filtros.status === 'todos' || r.status === filtros.status) && (filtros.setor === 'todos' || r.departamento_id === filtros.setor) && (filtros.regime === 'todos' || r.regime === filtros.regime) && r.titulo.toLowerCase().includes(filtros.busca.toLowerCase()));
  return <div className="space-y-6 p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-bold">Requisições de contratação</h1><Button onClick={() => setEdit(vazio())} disabled={base.isLoading || !!base.error}><Plus className="mr-2 h-4 w-4" />Nova requisição de contratação</Button></div>
    {(lista.error || base.error) && <Alert variant="destructive"><AlertDescription>{(lista.error || base.error)?.message}<Button variant="outline" className="ml-3" onClick={() => { void lista.refetch(); void base.refetch(); }}>Tentar novamente</Button></AlertDescription></Alert>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Input placeholder="Buscar título da vaga" aria-label="Buscar título da vaga" value={filtros.busca} onChange={e => setFiltros(f => ({ ...f, busca: e.target.value }))} />
      <Escolha label="Status" value={filtros.status} options={[{ id: 'todos', nome: 'Todos' }, ...Object.entries(STATUS_REQUISICAO).map(([id, nome]) => ({ id, nome }))]} onChange={s => setFiltros(f => ({ ...f, status: s ?? 'todos' }))} />
      <Escolha label="Setor" value={filtros.setor} options={[{ id: 'todos', nome: 'Todos' }, ...(base.data?.deps ?? [])]} onChange={s => setFiltros(f => ({ ...f, setor: s ?? 'todos' }))} />
      <Escolha label="Regime" value={filtros.regime} options={[{ id: 'todos', nome: 'Todos' }, ...options(['CLT', 'PJ', 'Estágio', 'Temporário'])]} onChange={s => setFiltros(f => ({ ...f, regime: s ?? 'todos' }))} /></div>
    {lista.isLoading ? <Skeleton className="h-40 w-full" /> : <Table><TableHeader><TableRow><TableHead>Vaga</TableHead><TableHead>Setor</TableHead><TableHead>Regime</TableHead><TableHead>Vagas</TableHead><TableHead>Status</TableHead><TableHead>Criada em</TableHead></TableRow></TableHeader><TableBody>{rows.map(r => <TableRow key={r.id} role="button" tabIndex={0} className="cursor-pointer" onClick={() => setEdit(r)} onKeyDown={e => { if (e.key === 'Enter') setEdit(r); }}><TableCell className="font-medium">{r.titulo || 'Sem título'}</TableCell><TableCell>{base.data?.deps.find(d => d.id === r.departamento_id)?.nome ?? '—'}</TableCell><TableCell>{r.regime}</TableCell><TableCell>{r.quantidade}</TableCell><TableCell><Badge variant={r.status === 'reprovada' ? 'destructive' : 'outline'}>{STATUS_REQUISICAO[r.status]}</Badge></TableCell><TableCell>{dia(r.created_at)}</TableCell></TableRow>)}{!rows.length && <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">Nenhuma requisição encontrada</TableCell></TableRow>}</TableBody></Table>}
    <Sheet open={!!edit} onOpenChange={o => { if (!o && !busy) setEdit(null); }}><SheetContent className="w-full overflow-y-auto sm:max-w-[900px]">
      <SheetHeader><SheetTitle>{edit?.id ? edit.titulo || 'Requisição' : 'Nova requisição de contratação'}</SheetTitle><SheetDescription>{edit ? STATUS_REQUISICAO[edit.status] : ''}</SheetDescription></SheetHeader>
      {edit && <div className="space-y-6 py-6">
        {edit.status === 'em_aprovacao' && <Alert><AlertDescription>A requisição está congelada. As assinaturas e decisões de aprovação serão habilitadas na Fase 5.</AlertDescription></Alert>}
        <fieldset disabled={!editable || busy} className="space-y-6">
          <section className="space-y-4"><h2 className="font-semibold">Vaga e estrutura</h2><div className="grid gap-4 sm:grid-cols-2">
            {texto('titulo', 'Título da vaga')}{texto('centro_custo', 'Centro de custo')}
            <Escolha label="Setor da vaga" value={edit.departamento_id} options={base.data?.deps ?? []} onChange={s => patch({ departamento_id: s })} disabled={!editable || busy} />
            <Escolha label="Cargo" value={edit.cargo_catalogo_id} options={(base.data?.cargos ?? []).map(c => ({ id: c.id, nome: c.nome_exibicao }))} onChange={s => patch({ cargo_catalogo_id: s })} disabled={!editable || busy} />
            <Escolha label="Tipo" value={edit.tipo} options={[{ id: 'aumento_quadro', nome: 'Aumento de quadro' }, { id: 'substituicao', nome: 'Substituição' }]} onChange={s => patch({ tipo: s ?? 'aumento_quadro' })} disabled={!editable || busy} />
            <div className="space-y-2"><Label htmlFor="quantidade">Quantidade de vagas</Label><Input id="quantidade" type="number" min={1} step={1} value={edit.quantidade} onChange={e => patch({ quantidade: Number(e.target.value) })} /></div>
            {edit.tipo === 'substituicao' && <Escolha label="Colaborador substituído" value={edit.substituido_employee_id} options={base.data?.pessoas ?? []} onChange={s => patch({ substituido_employee_id: s })} disabled={!editable || busy} />}
          </div></section>
          <section className="space-y-4 border-t pt-5"><h2 className="font-semibold">Descrição do cargo</h2><div className="grid gap-4 sm:grid-cols-2">{texto('missao', 'Missão do cargo', true)}{texto('responsabilidades', 'Responsabilidades', true)}{texto('requisitos_obrigatorios', 'Requisitos obrigatórios', true)}{texto('requisitos_desejaveis', 'Requisitos desejáveis', true)}{texto('competencias', 'Competências comportamentais', true)}{texto('indicadores', 'Indicadores de sucesso', true)}</div></section>
          <section className="space-y-4 border-t pt-5"><h2 className="font-semibold">Contratação e remuneração</h2><div className="grid gap-4 sm:grid-cols-2">
            <Escolha label="Regime de contratação" value={edit.regime} options={options(['CLT', 'PJ', 'Estágio', 'Temporário'])} onChange={s => patch({ regime: s ?? 'CLT' })} disabled={!editable || busy} />
            <div className="space-y-2"><Label htmlFor="salario">{edit.regime === 'PJ' ? 'Valor mensal (R$)' : 'Salário base (R$)'}</Label><Input id="salario" type="number" min={0} step="0.01" value={edit.salario_base} onChange={e => patch({ salario_base: Number(e.target.value) })} />{cargo && <p className="text-xs text-muted-foreground">Faixa de referência: {cargo.faixa_salarial_min === null ? 'Sem mínimo' : moeda(cargo.faixa_salarial_min)} — {cargo.faixa_salarial_max === null ? 'Sem máximo' : moeda(cargo.faixa_salarial_max)}</p>}</div>
            {texto('variavel', 'Variável / comissão')}{texto('beneficios', 'Benefícios', true)}
            <Escolha label="Modelo de trabalho" value={edit.modelo_trabalho} options={[{ id: 'presencial', nome: 'Presencial' }, { id: 'hibrido', nome: 'Híbrido' }, { id: 'remoto', nome: 'Remoto' }]} onChange={s => patch({ modelo_trabalho: s ?? 'presencial' })} disabled={!editable || busy} />
            {texto('local', 'Local')}<div className="space-y-2"><Label htmlFor="inicio">Data desejada de início</Label><Input id="inicio" type="date" value={edit.data_inicio ?? ''} onChange={e => patch({ data_inicio: e.target.value || null })} /></div>
          </div>{texto('justificativa', `Justificativa da necessidade${obrigatoria ? ' (obrigatória)' : ' (opcional)'}`, true)}</section>
        </fieldset>
        {!!edit.atores_previstos?.length && <section className="space-y-2 border-t pt-5"><h2 className="font-semibold">Atores previstos da contratação</h2>{edit.atores_previstos.map((a, i) => <p key={i} className="text-sm">{a.papel} · {base.data?.pessoas.find(p => p.id === a.employee_id)?.nome || (a.role === 'rh' ? 'RH' : a.role || 'Conforme hierarquia')}</p>)}</section>}
        {edit.status === 'em_recrutamento' && rh && <Escolha label="Colaborador contratado" value={edit.contratado_employee_id} options={base.data?.pessoas ?? []} disabled={busy} onChange={s => patch({ contratado_employee_id: s })} />}
        {edit.contratado_employee_id && <Button variant="link" asChild><a href={`/rh/colaboradores/${edit.contratado_employee_id}`}><ExternalLink className="mr-2 h-4 w-4" />Ficha de admissão · Colaborador</a></Button>}
        <div className="flex flex-wrap gap-2 border-t pt-5">
          {editable && <><Button disabled={busy} variant="outline" onClick={() => void salvar()}><Save className="mr-2 h-4 w-4" />Salvar rascunho</Button><Button disabled={busy} onClick={() => void salvar('em_aprovacao')}><Send className="mr-2 h-4 w-4" />Enviar para aprovação</Button></>}
          {rh && edit.status === 'aprovada' && <Button disabled={busy} onClick={() => void salvar('em_recrutamento')}>Iniciar recrutamento</Button>}
          {rh && edit.status === 'em_recrutamento' && <Button disabled={busy || !edit.contratado_employee_id} onClick={() => void salvar('concluida')}>Concluir contratação</Button>}
          {podeAcao && ['rascunho', 'devolvida', 'em_aprovacao', ...(rh ? ['aprovada', 'em_recrutamento'] : [])].includes(edit.status) && <Button disabled={busy} variant="destructive" onClick={() => void salvar('cancelada')}>Cancelar requisição</Button>}
          {busy && <Loader2 aria-label="Salvando" className="h-5 w-5 animate-spin" />}
        </div>
      </div>}
    </SheetContent></Sheet>
  </div>;
}