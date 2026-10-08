import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Upload, Link2, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { POS_VENDA_ORIGIN_ID } from '@/lib/posVenda';

interface Props {
  dealId: string;
  stageId: string | null | undefined;
}

interface Entregavel { id: string; stage_id: string; titulo: string; tipo: string; obrigatorio: boolean; ordem: number }
interface Anexo { id: string; entregavel_id: string; arquivo_path: string | null; link_url: string | null; created_at: string; enviado_por: string | null }

const db = supabase as any;

/** Entregáveis obrigatórios por etapa — só na pipeline Relacionamento - Pós venda. */
export function PosVendaEntregaveisSection({ dealId, stageId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  const { data } = useQuery({
    queryKey: ['pos-venda-entregaveis', dealId],
    queryFn: async () => {
      const { data: stages } = await db.from('crm_stages').select('id, stage_name, stage_order')
        .eq('origin_id', POS_VENDA_ORIGIN_ID).order('stage_order');
      const { data: ents, error } = await db.from('crm_stage_entregaveis').select('*')
        .eq('is_active', true).in('stage_id', (stages || []).map((s: any) => s.id)).order('ordem');
      if (error) throw error;
      const { data: anexos, error: e2 } = await db.from('crm_deal_entregaveis').select('*').eq('deal_id', dealId);
      if (e2) throw e2;
      return { stages: (stages || []) as { id: string; stage_name: string; stage_order: number }[], ents: (ents || []) as Entregavel[], anexos: (anexos || []) as Anexo[] };
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['pos-venda-entregaveis', dealId] });

  const registrar = async (entregavelId: string, patch: { arquivo_path?: string; link_url?: string }) => {
    const { error } = await db.from('crm_deal_entregaveis').insert({
      deal_id: dealId, entregavel_id: entregavelId, enviado_por: user?.id, ...patch,
    });
    if (error) throw error;
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !alvo) return;
    setEnviando(true);
    try {
      const path = `${dealId}/${alvo}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
      const { error } = await supabase.storage.from('pos-venda-entregaveis').upload(path, file);
      if (error) throw error;
      await registrar(alvo, { arquivo_path: path });
      toast.success('Entregável anexado');
      refresh();
    } catch (err: any) {
      toast.error(`Erro ao anexar: ${err?.message || 'tente novamente'}`);
    } finally {
      setEnviando(false);
      setAlvo(null);
    }
  };

  const salvarLink = async (entregavelId: string) => {
    const url = (links[entregavelId] || '').trim();
    if (!/^https?:\/\//i.test(url)) { toast.error('Informe um link começando com http(s)://'); return; }
    try {
      await registrar(entregavelId, { link_url: url });
      setLinks((l) => ({ ...l, [entregavelId]: '' }));
      toast.success('Conteúdo registrado');
      refresh();
    } catch (err: any) { toast.error(err?.message || 'Erro ao salvar'); }
  };

  const abrir = async (a: Anexo) => {
    if (a.link_url) { window.open(a.link_url, '_blank'); return; }
    if (!a.arquivo_path) return;
    const { data: s, error } = await supabase.storage.from('pos-venda-entregaveis').createSignedUrl(a.arquivo_path, 300);
    if (error || !s) { toast.error('Não foi possível abrir o arquivo'); return; }
    window.open(s.signedUrl, '_blank');
  };

  const remover = async (a: Anexo) => {
    const { error } = await db.from('crm_deal_entregaveis').delete().eq('id', a.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };

  if (!data) return null;

  return (
    <div className="mt-2 border rounded-lg p-3 space-y-3">
      <input ref={fileRef} type="file" className="hidden" onChange={onFile} />
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Entregáveis das etapas</span>
      </div>
      <p className="text-xs text-muted-foreground">O card só avança para a próxima etapa com os entregáveis obrigatórios anexados.</p>
      {data.stages.map((st) => {
        const ents = data.ents.filter((e) => e.stage_id === st.id);
        if (!ents.length) return null;
        const atual = st.id === stageId;
        return (
          <div key={st.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{st.stage_name}</span>
              {atual && <Badge variant="outline" className="text-[10px]">etapa atual</Badge>}
            </div>
            {ents.map((e) => {
              const anexos = data.anexos.filter((a) => a.entregavel_id === e.id);
              const ok = anexos.length > 0;
              return (
                <div key={e.id} className="rounded-md bg-muted/40 p-2 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    {ok ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                    <span className="flex-1">{e.titulo}</span>
                    {e.obrigatorio && <Badge variant="secondary" className="text-[10px]">obrigatório</Badge>}
                  </div>
                  {anexos.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-xs pl-6">
                      <button className="underline text-primary truncate flex-1 text-left" onClick={() => abrir(a)}>
                        {a.link_url || a.arquivo_path?.split('/').pop()}
                      </button>
                      <span className="text-muted-foreground">{new Date(a.created_at).toLocaleDateString('pt-BR')}</span>
                      {a.enviado_por === user?.id && (
                        <button onClick={() => remover(a)} aria-label="Remover"><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></button>
                      )}
                    </div>
                  ))}
                  <div className="flex gap-2 pl-6">
                    <Button size="sm" variant="outline" disabled={enviando}
                      onClick={() => { setAlvo(e.id); fileRef.current?.click(); }}>
                      <Upload className="h-3.5 w-3.5 mr-1" /> Anexar arquivo
                    </Button>
                    <Input className="h-8 text-xs" placeholder="ou cole um link de conteúdo"
                      value={links[e.id] || ''} onChange={(ev) => setLinks((l) => ({ ...l, [e.id]: ev.target.value }))} />
                    <Button size="sm" variant="ghost" onClick={() => salvarLink(e.id)} aria-label="Salvar link">
                      <Link2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
