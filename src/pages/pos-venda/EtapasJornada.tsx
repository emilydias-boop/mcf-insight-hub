import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { toast } from 'sonner';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any };
type Etapa = { id: string; ordem: number; slug: string; codigo_trilha: string | null; titulo: string; descricao: string | null; icone: string | null; ativa: boolean };
const vazio = { slug: '', titulo: '', descricao: '', icone: '', codigo_trilha: '' };

export default function EtapasJornada() {
  const qc = useQueryClient();
  const [nova, setNova] = useState(vazio);
  const [edit, setEdit] = useState<Record<string, Partial<Etapa>>>({});
  const { data: etapas = [] } = useQuery({
    queryKey: ['jornada-etapas'],
    queryFn: async () => { const r = await db.from('jornada_etapas').select('*').order('ordem'); if (r.error) throw r.error; return (r.data ?? []) as Etapa[]; },
  });
  const recarregar = () => qc.invalidateQueries({ queryKey: ['jornada-etapas'] });
  const ok = (error: { message: string } | null, msg: string) => {
    if (error) { toast.error('Não foi possível salvar', { description: error.message }); return false; }
    toast.success(msg); recarregar(); return true;
  };

  const criar = async () => {
    if (!nova.slug.trim() || !nova.titulo.trim()) return toast.error('Informe código e título');
    const ordem = (etapas.at(-1)?.ordem ?? 0) + 10;
    const { error } = await db.from('jornada_etapas').insert({ ...nova, codigo_trilha: nova.codigo_trilha || null, slug: nova.slug.trim().toLowerCase(), ordem });
    if (ok(error, 'Etapa criada')) setNova(vazio);
  };
  const salvar = async (e: Etapa) => {
    const { error } = await db.from('jornada_etapas').update(edit[e.id]).eq('id', e.id);
    if (ok(error, 'Etapa salva')) setEdit((s) => { const n = { ...s }; delete n[e.id]; return n; });
  };
  const trocar = async (i: number, j: number) => {
    const a = etapas[i], b = etapas[j];
    if (!a || !b) return;
    // troca em 3 passos por causa da ordem única
    let r = await db.from('jornada_etapas').update({ ordem: -a.ordem }).eq('id', a.id);
    if (!r.error) r = await db.from('jornada_etapas').update({ ordem: a.ordem }).eq('id', b.id);
    if (!r.error) r = await db.from('jornada_etapas').update({ ordem: b.ordem }).eq('id', a.id);
    ok(r.error, 'Ordem atualizada');
  };

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <h1 className="text-2xl font-semibold">Etapas da Jornada</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">Etapas</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {etapas.map((e, i) => {
            const v = { ...e, ...edit[e.id] };
            const set = (k: keyof Etapa, val: unknown) => setEdit((s) => ({ ...s, [e.id]: { ...s[e.id], [k]: val } }));
            return (
              <div key={e.id} className="grid grid-cols-1 gap-2 items-center border-b pb-3 md:grid-cols-[40px_70px_1fr_1fr_90px_auto]">
                <span className="text-sm text-muted-foreground">{e.ordem}</span>
                <Input aria-label={`Código da trilha para ${e.titulo}`} placeholder="f3–f8" value={v.codigo_trilha ?? ''} onChange={(x) => set('codigo_trilha', x.target.value || null)} />
                <Input value={v.titulo} onChange={(x) => set('titulo', x.target.value)} />
                <Input value={v.descricao ?? ''} onChange={(x) => set('descricao', x.target.value)} />
                <Input value={v.icone ?? ''} placeholder="ícone" onChange={(x) => set('icone', x.target.value)} />
                <div className="flex items-center gap-1">
                  <Switch checked={v.ativa} onCheckedChange={(c) => set('ativa', c)} aria-label="Ativa" />
                  <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => trocar(i, i - 1)} aria-label="Subir"><ArrowUp className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" disabled={i === etapas.length - 1} onClick={() => trocar(i, i + 1)} aria-label="Descer"><ArrowDown className="h-4 w-4" /></Button>
                  <Button size="sm" disabled={!edit[e.id]} onClick={() => salvar(e)}>Salvar</Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Nova etapa</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <Input placeholder="código" value={nova.slug} onChange={(x) => setNova({ ...nova, slug: x.target.value })} />
          <Input placeholder="código da trilha (f3–f8)" value={nova.codigo_trilha} onChange={(x) => setNova({ ...nova, codigo_trilha: x.target.value })} />
          <Input placeholder="título" value={nova.titulo} onChange={(x) => setNova({ ...nova, titulo: x.target.value })} />
          <Input placeholder="descrição" value={nova.descricao} onChange={(x) => setNova({ ...nova, descricao: x.target.value })} />
          <Input placeholder="ícone" value={nova.icone} onChange={(x) => setNova({ ...nova, icone: x.target.value })} />
          <Button onClick={criar}>Criar</Button>
        </CardContent>
      </Card>
    </div>
  );
}
