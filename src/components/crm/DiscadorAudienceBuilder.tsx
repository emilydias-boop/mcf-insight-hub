import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, Info, Users, Send, Eye, AlertTriangle } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { useSendDealsToDialer } from '@/hooks/useSonaxDialer';

const LIMITE_ENVIO = 200;

const BUS = [
  { value: 'incorporador', label: 'Incorporador' },
  { value: 'consorcio', label: 'Consórcio' },
  { value: 'credito', label: 'Crédito' },
  { value: 'solar', label: 'Solar' },
];

const TIPOS_DATA = [
  { value: 'entrada', label: 'Entrada do lead no CRM' },
  { value: 'ultimo_contato', label: 'Sem toque desde' },
  { value: 'etapa', label: 'Entrada na etapa atual' },
];

interface OpcoesFiltro {
  estagios: { id: string; nome: string; qtd: number }[];
  tags: { nome: string; qtd: number }[];
}

interface LeadPublico {
  deal_id: string;
  nome: string | null;
  telefone: string | null;
  etapa: string | null;
  tags: string[] | null;
  data_ref: string | null;
}

const rpc = (name: string, params: Record<string, unknown>) =>
  (supabase.rpc as any)(name, params);

function MultiSelectBox({
  itens, selecionados, onToggle, vazio,
}: {
  itens: { key: string; label: string; qtd: number }[];
  selecionados: string[];
  onToggle: (key: string) => void;
  vazio: string;
}) {
  if (!itens.length) {
    return <p className="text-xs text-muted-foreground py-2">{vazio}</p>;
  }
  return (
    <div className="max-h-40 overflow-auto rounded-md border border-border divide-y divide-border/50">
      {itens.map((i) => (
        <label
          key={i.key}
          className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-accent/40"
        >
          <Checkbox
            checked={selecionados.includes(i.key)}
            onCheckedChange={() => onToggle(i.key)}
          />
          <span className="flex-1 truncate">{i.label}</span>
          <span className="text-xs text-muted-foreground">{i.qtd}</span>
        </label>
      ))}
    </div>
  );
}

export default function DiscadorAudienceBuilder() {
  const [bu, setBu] = useState<string>('incorporador');
  const [tipoData, setTipoData] = useState<string>('entrada');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [stageIds, setStageIds] = useState<string[]>([]);
  const [amostra, setAmostra] = useState<LeadPublico[] | null>(null);
  const [carregandoAmostra, setCarregandoAmostra] = useState(false);
  const [progresso, setProgresso] = useState<{ feitos: number; total: number } | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);

  const enviar = useSendDealsToDialer();

  const { data: opcoes, isLoading: loadingOpcoes } = useQuery({
    queryKey: ['discador-opcoes-filtro', bu],
    queryFn: async (): Promise<OpcoesFiltro> => {
      const { data, error } = await rpc('discador_opcoes_filtro', { _bu: bu });
      if (error) throw error;
      const d = (data || {}) as any;
      return { estagios: d.estagios || [], tags: d.tags || [] };
    },
    staleTime: 5 * 60 * 1000,
  });

  const filtros = useMemo(() => ({
    _bu: bu,
    _tipo_data: tipoData,
    _de: de || null,
    _ate: ate || null,
    _tags: tags.length ? tags : null,
    _stage_ids: stageIds.length ? stageIds : null,
  }), [bu, tipoData, de, ate, tags, stageIds]);

  const filtrosDebounced = useDebounce(filtros, 400);

  const { data: total, isFetching: contando } = useQuery({
    queryKey: ['discador-publico-count', filtrosDebounced],
    queryFn: async (): Promise<number> => {
      const { data, error } = await rpc('discador_publico', {
        ...filtrosDebounced, _limite: null, _apenas_contar: true,
      });
      if (error) throw error;
      return Number((data as any)?.total ?? 0);
    },
    placeholderData: (prev) => prev,
  });

  // Troca de BU limpa seleções dependentes
  useEffect(() => {
    setTags([]);
    setStageIds([]);
    setAmostra(null);
    setSelecionados([]);
  }, [bu]);

  const buscarAmostra = async () => {
    setCarregandoAmostra(true);
    try {
      const { data, error } = await rpc('discador_publico', {
        ...filtros, _limite: 50, _apenas_contar: false,
      });
      if (error) throw error;
      setAmostra(((data as any)?.leads || []) as LeadPublico[]);
    } finally {
      setCarregandoAmostra(false);
    }
  };

  const excedente = Math.max(0, (total ?? 0) - LIMITE_ENVIO);

  const criarEEnviar = async () => {
    const { data, error } = await rpc('discador_publico', {
      ...filtros, _limite: LIMITE_ENVIO, _apenas_contar: false,
    });
    if (error) throw error;
    const leads = ((data as any)?.leads || []) as LeadPublico[];
    const ordenados = [...leads].sort((a, b) =>
      String(b.data_ref ?? '').localeCompare(String(a.data_ref ?? '')),
    ).slice(0, LIMITE_ENVIO);
    if (!ordenados.length) return;
    setProgresso({ feitos: 0, total: ordenados.length });
    try {
      await enviar.mutateAsync({
        dealIds: ordenados.map((l) => l.deal_id),
        bu,
        onProgress: (feitos, t) => setProgresso({ feitos, total: t }),
      });
    } finally {
      setProgresso(null);
    }
  };

  const fmtData = (v: string | null) =>
    v ? new Date(v).toLocaleDateString('pt-BR') : '—';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Montar campanha
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            As ligações atendidas caem numa <strong>fila única de ramais no Sonax</strong>: quem
            estiver logado nessa fila atende, independente da BU escolhida aqui. O filtro de BU
            define <strong>quais leads entram na campanha</strong>, não quem recebe a chamada.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">BU</Label>
            <Select value={bu} onValueChange={setBu}>
              <SelectTrigger aria-label="BU"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BUS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Recorte de data</Label>
            <Select value={tipoData} onValueChange={setTipoData}>
              <SelectTrigger aria-label="Recorte de data"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_DATA.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="disc-de">De</Label>
            <Input id="disc-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="disc-ate">Até</Label>
            <Input id="disc-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Tags {tags.length > 0 && <span className="text-muted-foreground">({tags.length})</span>}</Label>
            {loadingOpcoes ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <MultiSelectBox
                itens={(opcoes?.tags || []).map((t) => ({ key: t.nome, label: t.nome, qtd: t.qtd }))}
                selecionados={tags}
                onToggle={(k) => setTags((p) => p.includes(k) ? p.filter((x) => x !== k) : [...p, k])}
                vazio="Nenhuma tag com volume relevante nesta BU."
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Estágios {stageIds.length > 0 && <span className="text-muted-foreground">({stageIds.length})</span>}</Label>
            {loadingOpcoes ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <MultiSelectBox
                itens={(opcoes?.estagios || []).map((s) => ({ key: s.id, label: s.nome, qtd: s.qtd }))}
                selecionados={stageIds}
                onToggle={(k) => setStageIds((p) => p.includes(k) ? p.filter((x) => x !== k) : [...p, k])}
                vazio="Nenhum estágio com negócios nesta BU."
              />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
          <div className="text-sm" data-testid="discador-contador">
            {contando && total === undefined ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> calculando público...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <strong className="text-lg">{total ?? 0}</strong> leads elegíveis
                {contando && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={buscarAmostra} disabled={carregandoAmostra}>
              {carregandoAmostra ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
              Ver amostra
            </Button>
            <Button
              size="sm"
              onClick={criarEEnviar}
              disabled={enviar.isPending || !total}
            >
              {progresso ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  enviando {progresso.feitos} de {progresso.total}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Criar campanha e enviar
                  {excedente > 0 ? ` (${LIMITE_ENVIO} de ${total})` : ''}
                </>
              )}
            </Button>
          </div>
        </div>

        {excedente > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              O envio é limitado a {LIMITE_ENVIO} leads por vez. Serão enviados os {LIMITE_ENVIO} mais
              recentes por data de referência — <strong>{excedente} ficarão de fora</strong>. Refine o
              recorte de data ou dispare em lotes.
            </p>
          </div>
        )}

        {amostra && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Amostra ({amostra.length} de {total ?? 0})</p>
            {amostra.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum lead para esses filtros.</p>
            ) : (
              <div className="max-h-72 overflow-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Data ref.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {amostra.map((l) => (
                      <TableRow key={l.deal_id}>
                        <TableCell className="text-sm">{l.nome || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{l.telefone || '—'}</TableCell>
                        <TableCell className="text-sm">
                          {l.etapa ? <Badge variant="outline">{l.etapa}</Badge> : '—'}
                        </TableCell>
                        <TableCell className="text-sm">{fmtData(l.data_ref)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
