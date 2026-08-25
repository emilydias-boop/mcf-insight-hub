import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Calendar, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { parseYearMonthLocal, parseYmdLocal } from "@/lib/dateHelpers";
import { contarDiasUteis, getWeekStartsOn } from "@/lib/businessDays";
import { CONSORCIO_LABELS } from "@/lib/consorcioLabels";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSdrsAll } from "@/hooks/useSdrFechamento";
import {
  useConsorcioSdrReunioes,
  type SdrReuniaoDetalheItem,
} from "@/hooks/useConsorcioSdrDetalhe";
import {
  useConsorcioCotasContratadas,
  type ClienteVendaSdrItem,
  type CotaVendaSdrItem,
} from "@/hooks/useConsorcioCotasContratadas";
import { formatMeetingStatus } from "@/utils/formatMeetingStatus";
import { DealDetailsDrawer } from "@/components/crm/DealDetailsDrawer";

const BU = "consorcio";

const moeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const dataBr = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    return format(iso.length <= 10 ? new Date(`${iso}T12:00:00`) : new Date(iso), "dd/MM/yyyy", {
      locale: ptBR,
    });
  } catch {
    return "—";
  }
};

function KpiCard({
  titulo,
  valor,
  detalhe,
  isLoading,
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  isLoading?: boolean;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 space-y-1">
        <p className="text-xs text-muted-foreground">{titulo}</p>
        {isLoading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <p className="text-2xl font-semibold text-foreground">{valor}</p>
        )}
        {detalhe && <p className="text-xs text-muted-foreground">{detalhe}</p>}
      </CardContent>
    </Card>
  );
}

/** Reuniões: Lead · Data · Closer · Origem · Status. */
function ReunioesTable({
  itens,
  isLoading,
  vazio,
  onAbrirLead,
}: {
  itens: SdrReuniaoDetalheItem[];
  isLoading: boolean;
  vazio: string;
  onAbrirLead: (dealId: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter(
      (i) =>
        (i.nome || "").toLowerCase().includes(q) ||
        (i.closerNome || "").toLowerCase().includes(q) ||
        (i.origem || "").toLowerCase().includes(q),
    );
  }, [itens, busca]);

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Buscar por lead, closer ou origem…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-sm"
        />
        <span className="text-xs text-muted-foreground">{filtrados.length} registros</span>
      </div>
      <div className="rounded-md border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Closer</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  {vazio}
                </TableCell>
              </TableRow>
            )}
            {filtrados.map((i) => (
              <TableRow key={i.key}>
                <TableCell className="font-medium">{i.nome || "—"}</TableCell>
                <TableCell>{dataBr(i.dia)}</TableCell>
                <TableCell className="text-muted-foreground">{i.closerNome || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{i.origem || "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {i.status ? formatMeetingStatus(i.status) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {i.dealId ? (
                    <Button variant="ghost" size="sm" onClick={() => onAbrirLead(i.dealId!)}>
                      Abrir
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">sem lead</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** Vendas Realizadas: uma linha por CLIENTE. */
function ClientesTable({
  itens,
  isLoading,
}: {
  itens: ClienteVendaSdrItem[];
  isLoading: boolean;
}) {
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  return (
    <div className="rounded-md border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Contratação mais recente</TableHead>
            <TableHead className="text-center">Cotas do cliente</TableHead>
            <TableHead className="text-right">Crédito somado</TableHead>
            <TableHead>Closer</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                Nenhuma venda atribuída a este SDR no período.
              </TableCell>
            </TableRow>
          )}
          {itens.map((c) => (
            <TableRow key={c.pessoaKey}>
              <TableCell className="font-medium">{c.cliente || "—"}</TableCell>
              <TableCell>{dataBr(c.dataContratacao)}</TableCell>
              <TableCell className="text-center">{c.cotas}</TableCell>
              <TableCell className="text-right">{moeda(c.credito)}</TableCell>
              <TableCell className="text-muted-foreground">
                {c.closerNames.length > 0 ? c.closerNames.join(", ") : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Cotas Contratadas: uma linha por CARTA. */
function CotasTable({ itens, isLoading }: { itens: CotaVendaSdrItem[]; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  return (
    <div className="rounded-md border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Grupo</TableHead>
            <TableHead>Cota</TableHead>
            <TableHead>Contratação</TableHead>
            <TableHead className="text-right">Crédito</TableHead>
            <TableHead>Closer</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                Nenhuma cota contratada atribuída a este SDR no período.
              </TableCell>
            </TableRow>
          )}
          {itens.map((c) => (
            <TableRow key={c.cardId}>
              <TableCell className="font-medium">{c.cliente || "—"}</TableCell>
              <TableCell className="text-muted-foreground">{c.grupo || "—"}</TableCell>
              <TableCell className="text-muted-foreground">{c.cota || "—"}</TableCell>
              <TableCell>{dataBr(c.dataContratacao)}</TableCell>
              <TableCell className="text-right">{moeda(c.credito)}</TableCell>
              <TableCell className="text-muted-foreground">{c.closerName || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function SdrDetalheConsorcio() {
  const { sdrEmail: sdrEmailParam } = useParams<{ sdrEmail: string }>();
  const sdrEmail = decodeURIComponent(sdrEmailParam || "").trim().toLowerCase();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, role } = useAuth();
  const wso = getWeekStartsOn(BU);

  const preset = searchParams.get("preset") || "month";
  const monthParam = searchParams.get("month");

  const { startDate, endDate } = useMemo(() => {
    const hoje = new Date();
    if (preset === "today") return { startDate: startOfDay(hoje), endDate: endOfDay(hoje) };
    if (preset === "week")
      return {
        startDate: startOfWeek(hoje, { weekStartsOn: wso }),
        endDate: endOfWeek(hoje, { weekStartsOn: wso }),
      };
    if (preset === "custom") {
      return {
        startDate: parseYmdLocal(searchParams.get("start")) ?? startOfMonth(hoje),
        endDate: parseYmdLocal(searchParams.get("end")) ?? endOfMonth(hoje),
      };
    }
    const base = parseYearMonthLocal(monthParam) ?? hoje;
    return { startDate: startOfMonth(base), endDate: endOfMonth(base) };
  }, [preset, monthParam, searchParams, wso]);

  const isPrivilegedViewer = role === "admin" || role === "manager" || role === "coordenador";
  const accessDenied =
    !isPrivilegedViewer && (user?.email || "").trim().toLowerCase() !== sdrEmail;

  const reunioes = useConsorcioSdrReunioes(sdrEmail || undefined, startDate, endDate);
  const { data: cotasContratadas, isLoading: loadingCotas } = useConsorcioCotasContratadas(
    startDate,
    endDate,
    null,
    BU,
  );

  // Nome exibível: cadastro de SDR, com fallback no nome que a agenda devolveu.
  const { data: sdrs } = useSdrsAll();
  const cadastro = useMemo(
    () => (sdrs || []).find((s: any) => String(s.email || "").toLowerCase() === sdrEmail),
    [sdrs, sdrEmail],
  );
  const nome =
    (cadastro as any)?.name ||
    cotasContratadas?.sdrNames.get(sdrEmail) ||
    (sdrEmail ? sdrEmail.split("@")[0] : "SDR");

  // Meta do período: meta diária × dias úteis, com pró-rata para quem foi
  // admitido dentro da janela (mesma regra da coluna Meta no painel).
  const { data: admissao } = useQuery({
    queryKey: ["consorcio-sdr-detalhe-admissao", (cadastro as any)?.id],
    enabled: !!(cadastro as any)?.id,
    staleTime: 60000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("data_admissao")
        .eq("sdr_id", (cadastro as any).id)
        .not("data_admissao", "is", null)
        .maybeSingle();
      if (error) throw error;
      return data?.data_admissao ?? null;
    },
  });

  const diasUteisNoPeriodo = useMemo(
    () => contarDiasUteis(startDate, endDate),
    [startDate, endDate],
  );
  const diasEfetivos = useMemo(() => {
    if (!admissao) return diasUteisNoPeriodo;
    const dtAdm = new Date(admissao);
    if (dtAdm <= startDate) return diasUteisNoPeriodo;
    if (dtAdm > endDate) return 0;
    return contarDiasUteis(dtAdm, endDate);
  }, [admissao, startDate, endDate, diasUteisNoPeriodo]);
  const metaDiaria = Number((cadastro as any)?.meta_diaria) || 10;
  const metaPeriodo = metaDiaria * diasEfetivos;

  const cotas = cotasContratadas?.bySdr.get(sdrEmail) || 0;
  const clientes = cotasContratadas?.clientesBySdr.get(sdrEmail) || 0;
  const credito = cotasContratadas?.creditoBySdr.get(sdrEmail) || 0;
  const itensCotas = cotasContratadas?.itensBySdr.get(sdrEmail) || [];
  const itensClientes = cotasContratadas?.clientesItensBySdr.get(sdrEmail) || [];
  const ticket = clientes > 0 ? credito / clientes : 0;
  const convVendas = reunioes.realizadas.length > 0 ? (clientes / reunioes.realizadas.length) * 100 : 0;
  const noShowPct =
    reunioes.agendadas.length > 0 ? (reunioes.noShows.length / reunioes.agendadas.length) * 100 : 0;

  const [dealAberto, setDealAberto] = useState<string | null>(null);
  const abrirLead = (dealId: string) => setDealAberto(dealId);

  const voltar = () => {
    const params = new URLSearchParams();
    params.set("preset", preset);
    if (monthParam) params.set("month", monthParam);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    navigate(`/consorcio/painel-equipe?${params.toString()}`);
  };

  if (!sdrEmail) {
    return <div className="p-6 text-center text-muted-foreground">SDR não encontrado</div>;
  }
  if (accessDenied) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" size="sm" onClick={voltar}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar ao Painel Comercial
        </Button>
        <Card className="bg-card border-border max-w-xl">
          <CardContent className="p-6 space-y-2">
            <h1 className="text-lg font-semibold text-foreground">Detalhe indisponível</h1>
            <p className="text-sm text-muted-foreground">
              Você só pode abrir o seu próprio detalhe. Este link é de outro SDR. Volte ao Painel
              Comercial e clique na sua linha.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const periodo = `${format(startDate, "dd/MM/yyyy", { locale: ptBR })} - ${format(endDate, "dd/MM/yyyy", { locale: ptBR })}`;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={voltar} aria-label="Voltar ao Painel Comercial">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="w-12 h-12 rounded-full flex items-center justify-center font-semibold text-lg bg-primary/15 text-primary">
            {nome.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              {nome}
              <Badge variant="outline" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                SDR Consórcio
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">{sdrEmail}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          <Calendar className="h-4 w-4" />
          <span>{periodo}</span>
        </div>
      </div>

      {/* Cards — mesma ordem das colunas da linha do SDR no painel */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          titulo="Meta"
          valor={String(metaPeriodo)}
          detalhe={
            diasEfetivos !== diasUteisNoPeriodo
              ? `${diasEfetivos}/${diasUteisNoPeriodo} dias úteis`
              : `${diasUteisNoPeriodo} dias úteis × ${metaDiaria}`
          }
        />
        <KpiCard
          titulo="Agendamento"
          valor={String(reunioes.agendamentos.length)}
          detalhe="Pela data em que o SDR agendou"
          isLoading={reunioes.isLoading}
        />
        <KpiCard
          titulo={CONSORCIO_LABELS.reunioesAgendadas}
          valor={String(reunioes.agendadas.length)}
          detalhe="Pela data da reunião"
          isLoading={reunioes.isLoading}
        />
        <KpiCard
          titulo={CONSORCIO_LABELS.reunioesRealizadas}
          valor={String(reunioes.realizadas.length)}
          isLoading={reunioes.isLoading}
        />
        <KpiCard
          titulo="No-show"
          valor={String(reunioes.noShows.length)}
          detalhe={reunioes.agendadas.length > 0 ? `${noShowPct.toFixed(1)}%` : undefined}
          isLoading={reunioes.isLoading}
        />
        <KpiCard
          titulo="Vendas Realizadas"
          valor={String(clientes)}
          detalhe="Clientes distintos"
          isLoading={loadingCotas}
        />
        <KpiCard
          titulo="Cotas Contratadas"
          valor={String(cotas)}
          detalhe="Cartas contratadas"
          isLoading={loadingCotas}
        />
        <KpiCard titulo="Consórcio Efetivado" valor={moeda(credito)} isLoading={loadingCotas} />
        <KpiCard
          titulo="Ticket Médio"
          valor={clientes > 0 ? moeda(ticket) : "—"}
          isLoading={loadingCotas}
        />
        <KpiCard
          titulo={CONSORCIO_LABELS.convVendasReuniao}
          valor={`${convVendas.toFixed(1)}%`}
          isLoading={loadingCotas || reunioes.isLoading}
        />
      </div>

      <Tabs defaultValue="agendamentos" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="agendamentos">Agendamentos ({reunioes.agendamentos.length})</TabsTrigger>
          <TabsTrigger value="realizadas">
            {CONSORCIO_LABELS.reunioesRealizadas} ({reunioes.realizadas.length})
          </TabsTrigger>
          <TabsTrigger value="noshows">No-Shows ({reunioes.noShows.length})</TabsTrigger>
          <TabsTrigger value="vendas">Vendas Realizadas ({clientes})</TabsTrigger>
          <TabsTrigger value="cotas">Cotas Contratadas ({cotas})</TabsTrigger>
        </TabsList>

        <TabsContent value="agendamentos">
          <Card className="bg-card border-border">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Esta lista usa o dia em que o SDR marcou a reunião. Já a coluna
                "{CONSORCIO_LABELS.reunioesAgendadas}" do painel usa o dia em que a reunião
                acontece — por isso os dois números podem ser diferentes no mesmo período.
              </p>
              <ReunioesTable
                itens={reunioes.agendamentos}
                isLoading={reunioes.isLoading}
                vazio="Nenhuma reunião foi marcada por este SDR no período."
                onAbrirLead={abrirLead}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="realizadas">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <ReunioesTable
                itens={reunioes.realizadas}
                isLoading={reunioes.isLoading}
                vazio="Nenhuma reunião deste SDR foi realizada no período."
                onAbrirLead={abrirLead}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="noshows">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <ReunioesTable
                itens={reunioes.noShows}
                isLoading={reunioes.isLoading}
                vazio="Nenhum no-show deste SDR no período."
                onAbrirLead={abrirLead}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vendas">
          <Card className="bg-card border-border">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Uma linha por pessoa: {clientes} clientes, {cotas} cotas, {moeda(credito)} de
                crédito. Vendas Realizadas conta pessoas, não cartas — um cliente com 3 cotas soma 1
                aqui e 3 na aba Cotas Contratadas. Todas as cotas do cliente vão para o SDR da
                última reunião de consórcio que ele agendou.
              </p>
              <ClientesTable itens={itensClientes} isLoading={loadingCotas} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cotas">
          <Card className="bg-card border-border">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Uma linha por carta contratada: {cotas} cotas de {clientes} clientes. É a mesma
                venda da aba anterior aberta carta por carta — lá se conta gente, aqui se conta
                contrato.
              </p>
              <CotasTable itens={itensCotas} isLoading={loadingCotas} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DealDetailsDrawer
        dealId={dealAberto}
        open={!!dealAberto}
        onOpenChange={(o) => !o && setDealAberto(null)}
      />
    </div>
  );
}
