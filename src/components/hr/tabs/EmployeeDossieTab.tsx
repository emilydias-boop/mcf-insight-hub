import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useDossie, useDossieLegado, type RegistroDossie } from '@/hooks/useDossie';
import { registroEditavel, resumoDossie, TIPOS_DOSSIE, type TipoDossie } from '@/lib/dossie';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Paperclip, Lock, MessageSquarePlus } from 'lucide-react';
import { toast } from 'sonner';

const dataSP = (d: string) => new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
const localSP = (d: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(d)).replace(' ', 'T');
const vazio = () => ({ titulo: '', conteudo: '', tipo: 'one_on_one' as TipoDossie, status: 'registrado', confidencial: false, ocorrido: localSP(new Date().toISOString()), original_id: null as string | null });
export default function EmployeeDossieTab({ employeeId, userId = null }: { employeeId: string; userId?: string | null }) {
  const { user } = useAuth();
  const q = useDossie(employeeId);
  const legado = useDossieLegado(employeeId, userId, !!q.data?.gestor);
  const [meses, setMeses] = useState(3);
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<RegistroDossie | null>(null);
  const [form, setForm] = useState(vazio);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [ciencia, setCiencia] = useState<RegistroDossie | null>(null);
  const [comentario, setComentario] = useState('');
  const [decisao, setDecisao] = useState('ciente');
  const [erro, setErro] = useState('');
  const novo = (r?: RegistroDossie, adendo = false) => {
    setEdit(adendo ? null : r ?? null); setFiles([]); setErro('');
    setForm(r ? { titulo: adendo ? `Adendo: ${r.titulo}` : r.titulo, conteudo: adendo ? '' : r.conteudo, tipo: adendo ? 'adendo' : r.tipo, status: adendo ? 'registrado' : r.status, confidencial: r.confidencial, ocorrido: adendo ? vazio().ocorrido : localSP(r.ocorrido_em), original_id: adendo ? r.id : r.original_id } : vazio()); setOpen(true);
  };
  const salvar = async () => {
    if (!form.titulo.trim() || !form.conteudo.trim()) { setErro('Preencha título e conteúdo.'); return; }
    setBusy(true); setErro('');
    let registroSalvo = false;
    try {
      const id = edit?.id ?? crypto.randomUUID();
      const payload = { employee_id: employeeId, titulo: form.titulo.trim(), conteudo: form.conteudo.trim(), tipo: form.tipo, status: form.status, confidencial: form.confidencial, ocorrido_em: new Date(`${form.ocorrido}:00-03:00`).toISOString(), original_id: form.original_id };
      const res = edit ? await supabase.from('gov_dossie_registros').update(payload).eq('id', id).select().single() : await supabase.from('gov_dossie_registros').insert({ ...payload, id }).select().single();
      if (res.error) throw res.error;
      registroSalvo = true;
      const anexos = [...(edit?.anexos ?? [])];
      for (const file of files) {
        const path = `${id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const uploaded = await supabase.storage.from('rh-dossie-evidencias').upload(path, file);
        if (uploaded.error) throw uploaded.error;
        anexos.push({ path, nome: file.name });
        const saved = await supabase.from('gov_dossie_registros').update({ anexos }).eq('id', id).select().single();
        if (saved.error) throw saved.error;
      }
      toast.success('Registro salvo'); setOpen(false);
    } catch(e) { const msg = e instanceof Error ? e.message : (e as { message?: string }).message ?? 'Não foi possível salvar'; if (registroSalvo) { toast.error(`Registro salvo, mas um anexo falhou: ${msg}`); setOpen(false); } else setErro(msg); }
    finally { setBusy(false); await q.refetch(); }
  };
  const confirmar = async () => {
    if (!ciencia) return;
    setBusy(true);
    const res = await supabase.from('gov_dossie_ciencias').insert({ registro_id: ciencia.id, decisao, comentario });
    setBusy(false);
    if (res.error) toast.error(res.error.message); else { setCiencia(null); toast.success('Resposta registrada'); await q.refetch(); }
  };
  const baixar = async (path: string, nome: string) => {
    const r = await supabase.storage.from('rh-dossie-evidencias').download(path);
    if (r.error) { toast.error(r.error.message); return; }
    const url = URL.createObjectURL(r.data); const a = document.createElement('a'); a.href=url; a.download=nome; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (q.isLoading) return <p className="text-muted-foreground">Carregando dossiê…</p>;
  if (q.error) return <div className="space-y-2"><p className="text-destructive">Não foi possível carregar o dossiê: {q.error.message}</p><Button variant="outline" onClick={() => q.refetch()}>Tentar novamente</Button></div>;
  const registros = q.data?.registros ?? [];
  const resumo = resumoDossie(registros, meses);
  const statusOpcoes = ['yellow_flag','red_flag'].includes(form.tipo) ? ['aberta','resolvida'] : form.tipo==='pdi' ? ['nao_iniciado','em_andamento','concluido','cancelado'] : ['registrado'];
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Dossiê do colaborador</h2>{q.data?.gestor && <Button onClick={() => novo()}><Plus className="mr-2 h-4 w-4"/>Novo registro</Button>}</div>
    <div className="flex flex-wrap gap-3"><Select value={String(meses)} onValueChange={v => setMeses(Number(v))}><SelectTrigger className="w-40" aria-label="Período do resumo"><SelectValue/></SelectTrigger><SelectContent>{[3,6,12].map(m => <SelectItem key={m} value={String(m)}>{m} meses</SelectItem>)}</SelectContent></Select><Select value={tipoFiltro} onValueChange={setTipoFiltro}><SelectTrigger className="w-48" aria-label="Tipo de registro"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="todos">Todos os registros</SelectItem>{Object.entries(TIPOS_DOSSIE).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
    <dl className="grid grid-cols-2 gap-4 border-y py-4 sm:grid-cols-3 lg:grid-cols-6">{[['One on One',resumo.one_on_one],['Feedbacks',resumo.feedback],['Yellow Flags',resumo.yellow_flag],['Red Flags',resumo.red_flag],['Flags abertas',resumo.flags_abertas],['Última 1:1',resumo.ultima_one_on_one ? dataSP(resumo.ultima_one_on_one) : '—']].map(([k,v]) => <div key={k}><dt className="text-sm text-muted-foreground">{k}</dt><dd className="font-semibold">{v}</dd></div>)}</dl>
    <div className="divide-y">{registros.filter(r => tipoFiltro==='todos' || r.tipo===tipoFiltro).map(r => {
      const resposta = q.data?.ciencias.find(c => c.registro_id===r.id);
      const podeEditar = q.data?.gestor && registroEditavel(r.created_at,Date.now()) && !resposta && (r.created_by===user?.id);
      return <article key={r.id} className="py-5 space-y-3"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 space-y-1"><div className="flex flex-wrap gap-2"><Badge variant="outline">{TIPOS_DOSSIE[r.tipo]}</Badge><Badge variant="secondary">{r.status.replaceAll('_',' ')}</Badge>{r.confidencial && <Badge variant="outline"><Lock className="mr-1 h-3 w-3"/>Confidencial</Badge>}</div><h3 className="font-semibold break-words">{r.titulo}</h3><p className="text-xs text-muted-foreground">{dataSP(r.ocorrido_em)} · Registrado em {dataSP(r.created_at)}</p>{r.original_id && <p className="text-xs text-muted-foreground">Original: {registros.find(o => o.id===r.original_id)?.titulo ?? r.original_id}</p>}</div><div className="flex gap-1">{podeEditar && <Button size="icon" variant="ghost" title="Editar registro" aria-label="Editar registro" onClick={() => novo(r)}><Pencil className="h-4 w-4"/></Button>}{q.data?.gestor && r.tipo!=='adendo' && <Button size="icon" variant="ghost" title="Acrescentar adendo" aria-label="Acrescentar adendo" onClick={() => novo(r,true)}><MessageSquarePlus className="h-4 w-4"/></Button>}</div></div><p className="whitespace-pre-wrap break-words text-sm">{r.conteudo}</p><div className="flex flex-wrap gap-2">{r.anexos.map(a => <Button key={a.path} variant="outline" size="sm" className="max-w-full" onClick={() => baixar(a.path,a.nome)}><Paperclip className="h-4 w-4 mr-2 shrink-0"/><span className="truncate">{a.nome}</span></Button>)}</div>{resposta ? <div className="border-l-2 pl-3 text-sm"><p>{resposta.decisao==='ciente' ? 'Ciência confirmada' : 'Ciência recusada'} · {dataSP(resposta.created_at)}</p>{resposta.comentario && <p className="whitespace-pre-wrap break-words text-muted-foreground">{resposta.comentario}</p>}</div> : q.data?.proprio && !r.confidencial && <Button size="sm" variant="outline" onClick={() => {setCiencia(r);setComentario('');setDecisao('ciente');}}>Registrar ciência ou recusa</Button>}</article>;
    })}</div>{registros.length===0 && <p className="text-muted-foreground">Nenhum registro no dossiê.</p>}
    {q.data?.gestor && <section className="border-t pt-5 space-y-3"><h3 className="font-semibold">Registros anteriores</h3>{legado.isLoading && <p>Carregando…</p>}{legado.error && <p className="text-destructive">Não foi possível carregar os registros anteriores: {legado.error.message}</p>}{legado.data?.map(r => <article key={r.id} className="border-b pb-4 space-y-1"><Badge variant="outline">Registro anterior · {r.tipo}</Badge><h4 className="font-medium break-words">{r.titulo}</h4><p className="text-xs text-muted-foreground">{r.data ? dataSP(r.data) : 'Data não registrada'}</p><p className="text-sm whitespace-pre-wrap break-words">{r.conteudo}</p></article>)}</section>}
    <Dialog open={open} onOpenChange={v => {if(!busy)setOpen(v);}}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{edit ? 'Editar registro' : form.original_id ? 'Novo adendo' : 'Novo registro'}</DialogTitle></DialogHeader><div className="space-y-3"><Label htmlFor="dossie-titulo">Título</Label><Input id="dossie-titulo" value={form.titulo} maxLength={200} onChange={e => setForm({...form,titulo:e.target.value})}/><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label>Tipo</Label><Select value={form.tipo} disabled={!!form.original_id} onValueChange={v => setForm({...form,tipo:v as TipoDossie,status:['yellow_flag','red_flag'].includes(v)?'aberta':v==='pdi'?'nao_iniciado':'registrado'})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{Object.entries(TIPOS_DOSSIE).filter(([k])=>k!=='adendo' || !!form.original_id).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Status</Label><Select value={form.status} onValueChange={v=>setForm({...form,status:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{statusOpcoes.map(v=><SelectItem key={v} value={v}>{v.replaceAll('_',' ')}</SelectItem>)}</SelectContent></Select></div></div><Label htmlFor="dossie-data">Data e hora · Brasília</Label><Input id="dossie-data" type="datetime-local" value={form.ocorrido} onChange={e=>setForm({...form,ocorrido:e.target.value})}/><Label htmlFor="dossie-conteudo">Conteúdo</Label><Textarea id="dossie-conteudo" rows={6} maxLength={20000} value={form.conteudo} onChange={e=>setForm({...form,conteudo:e.target.value})}/><div className="flex gap-2 items-center"><Checkbox id="dossie-conf" disabled={!!form.original_id} checked={form.confidencial} onCheckedChange={v=>setForm({...form,confidencial:v===true})}/><Label htmlFor="dossie-conf">Confidencial</Label></div><Label htmlFor="dossie-files">Anexos (até 10 MB por arquivo)</Label><Input id="dossie-files" type="file" multiple onChange={e=>{const f=Array.from(e.target.files ?? []);if(f.some(x=>x.size>10*1024*1024)|| f.length+(edit?.anexos.length??0)>10){toast.error('Máximo de 10 anexos, com 10 MB cada.');e.target.value='';return;}setFiles(f);}}/>{erro && <p role="alert" className="text-destructive text-sm">{erro}</p>}<Button disabled={busy} onClick={salvar}>{busy?'Salvando…':'Salvar registro'}</Button></div></DialogContent></Dialog>
    <Dialog open={!!ciencia} onOpenChange={v=>{if(!v&&!busy)setCiencia(null);}}><DialogContent><DialogHeader><DialogTitle>Ciência do registro</DialogTitle></DialogHeader><p className="font-medium">{ciencia?.titulo}</p><Select value={decisao} onValueChange={setDecisao}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="ciente">Confirmar ciência</SelectItem><SelectItem value="recusou">Recusar ciência</SelectItem></SelectContent></Select><Label htmlFor="dossie-comentario">Comentário</Label><Textarea id="dossie-comentario" value={comentario} maxLength={5000} onChange={e=>setComentario(e.target.value)}/><Button disabled={busy} onClick={confirmar}>Registrar resposta</Button></DialogContent></Dialog>
  </div>;
}