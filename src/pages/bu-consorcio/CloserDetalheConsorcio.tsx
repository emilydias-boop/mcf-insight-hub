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
import { ArrowLeft, BadgeCheck, Briefcase, Calendar } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { getWeekStartsOn } from "@/lib/businessDays";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useConsorcioCloserCotas,
  useConsorcioCloserReunioes,
  type CotaDetalheItem,
  type ReuniaoDetalheItem,
} from "@/hooks/useConsorcioCloserDetalhe";
import { useConsorcioProducaoGerada, type ProducaoGeradaItem } from "@/hooks/useConsorcioProducaoGerada";
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

/** Lista de reuniões: nome, data, origem, SDR agendador, atalho para o lead. */
function ReunioesTable({
  itens,
  isLoading,
  onAbrirLead,
}: {
  itens: ReuniaoDetalheItem[];
  isLoading: boolean;
  onAbrirLead: (dealId: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter(
      (i) =>
        (i.nome || "").toLowerCase().includes(q) ||
        (i.sdrNome || "").toLowerCase().includes(q) ||
        (i.origem || "").toLowerCase().includes(q),
    );
  }, [itens, busca]);

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Buscar por lead, SDR ou origem…"
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
              <TableHead>Origem</TableHead>
              <TableHead>SDR agendador</TableHead>
              <TableHead className="text-right">Lead</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  Nenhum registro no período.
                </TableCell>
              </TableRow>
            )}
            {filtrados.map((i) => (
              <TableRow key={i.key}>
                <TableCell className="font-medium">{i.nome || "—"}</TableCell>
                <TableCell>{dataBr(i.dia)}</TableCell>
                <TableCell className="text-muted-foreground">{i.origem || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{i.sdrNome || "Não atribuído"}</TableCell>
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

/** Lista de cotas contratadas (Vendas Realizadas). */
function CotasTable({ itens, isLoading }: { itens: CotaDetalheItem[]; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  return (
    <div className="rounded-md border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Contratação</TableHead>
            <TableHead>Grupo/Cota</TableHead>
            <TableHead className="text-right">Crédito</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                Nenhuma cota contratada no período.
              </TableCell>
            </TableRow>
          )}
          {itens.map((c) => (
            <TableRow key={c.cardId}>
              <TableCell className="font-medium">{c.cliente || "—"}</TableCell>
              <TableCell>{dataBr(c.dataContratacao)}</TableCell>
              <TableCell className="text-muted-foreground">
                {[c.grupo, c.cota].filter(Boolean).join(" / ") || "—"}
              </TableCell>
              <TableCell className="text-right">{moeda(c.credito)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Faturamento: toda a Produção Gerada, com selo de efetivação por linha. */
function FaturamentoTab({
  itens,
  producaoCredito,
  producaoCartas,
  efetivadoCredito,
  cotas,
  isLoading,
  onAbrirLead,
}: {
  itens: ProducaoGeradaItem[];
  producaoCredito: number;
  producaoCartas: number;
  efetivadoCredito: number;
  cotas: number;
  isLoading: boolean;
  onAbrirLead: (dealId: string) => void;
}) {
  const pernaLabel: Record<ProducaoGeradaItem["perna"], string> = {
    A: "Proposta",
    B: "Cadastro",
    C: "Cota legada",
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          titulo="Produção Gerada"
          valor={moeda(producaoCredito)}
          detalhe={`${itens.length} registros · ${producaoCartas} cartas`}
          isLoading={isLoading}
        />
        <KpiCard titulo="Consórcio Efetivado" valor={moeda(efetivadoCredito)} detalhe={`${cotas} cotas contratadas`} isLoading={isLoading} />
        <KpiCard
          titulo="A efetivar"
          valor={moeda(Math.max(producaoCredito - efetivadoCredito, 0))}
          detalhe="Produção gerada que ainda não virou cota contratada"
          isLoading={isLoading}
        />
      </div>


      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="rounded-md border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Data-âncora</TableHead>
                <TableHead>Origem do registro</TableHead>
                <TableHead className="text-right">Crédito</TableHead>
                <TableHead>Efetivação</TableHead>
                <TableHead className="text-right">Lead</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Nenhuma venda gerada no período.
                  </TableCell>
                </TableRow>
              )}
              {itens.map((i) => (
                <TableRow key={i.key}>
                  <TableCell className="font-medium">{i.nome || "—"}</TableCell>
                  <TableCell>{dataBr(i.dataAncora)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {pernaLabel[i.perna]}
                    {i.cartas > 1 ? ` · ${i.cartas} cartas` : ""}
                  </TableCell>
                  <TableCell className="text-right">{moeda(i.credito)}</TableCell>
                  <TableCell>
                    {i.efetivado ? (
                      <Badge variant="outline" className="gap-1">
                        <BadgeCheck className="h-3 w-3" />
                        Efetivado
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Em andamento</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {i.dealId ? (
                      <Button variant="ghost" size="sm" onClick={() => onAbrirLead(i.dealId!)}>
                        Abrir
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Produção Gerada conta cada venda uma única vez, no mês em que ela apareceu no sistema
        (aceite da proposta ou do cadastro; cotas legadas, na contratação). Consórcio Efetivado é o
        crédito das cotas contratadas no período, âncora <code>data_contratacao</code> — por isso os
        dois números não precisam bater.
      </p>
    </div>
  );
}

export default function CloserDetalheConsorcio() {
  const { closerId } = useParams<{ closerId: string }>();
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
  const { data: myCloserId, isLoading: loadingOwn } = useQuery({
    queryKey: ["my-closer-id", user?.email],
    enabled: !isPrivilegedViewer && !!user?.email && role === "closer",
    queryFn: async () => {
      const { data } = await supabase
        .from("closers")
        .select("id")
        .ilike("email", user!.email!.toLowerCase())
        .maybeSingle();
      return data?.id ?? null;
    },
  });
  const accessDenied = !isPrivilegedViewer && !loadingOwn && !(!!myCloserId && myCloserId === closerId);

  const reunioes = useConsorcioCloserReunioes(closerId, startDate, endDate);
  const { data: cotas, isLoading: loadingCotas } = useConsorcioCloserCotas(closerId, startDate, endDate);
  const { data: producao, isLoading: loadingProducao } = useConsorcioProducaoGerada(startDate, endDate, BU);

  const linhaProducao = closerId ? producao?.byCloser.get(closerId) : undefined;
  const itensProducao = (closerId ? producao?.itensByCloser.get(closerId) : undefined) || [];

  const [dealAberto, setDealAberto] = useState<string | null>(null);

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

  // Atalho para o lead: abre o mesmo drawer usado no CRM, sem sair da auditoria.
  const abrirLead = (dealId: string) => setDealAberto(dealId);

  if (!closerId) {
    return <div className="p-6 text-center text-muted-foreground">Closer não encontrado</div>;
  }
  if (accessDenied) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Você só pode visualizar seu próprio Painel Comercial.
      </div>
    );
  }

  const nome = cotas?.closer?.name || "Carregando…";
  const periodo = `${format(startDate, "dd/MM/yyyy", { locale: ptBR })} - ${format(endDate, "dd/MM/yyyy", { locale: ptBR })}`;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={voltar} aria-label="Voltar ao Painel Comercial">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center font-semibold text-lg text-primary-foreground"
            style={{ backgroundColor: cotas?.closer?.color || undefined }}
          >
            {nome.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              {nome}
              <Badge variant="outline" className="text-xs">
                <Briefcase className="h-3 w-3 mr-1" />
                Closer Consórcio
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">{cotas?.closer?.email || ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          <Calendar className="h-4 w-4" />
          <span>{periodo}</span>
        </div>
      </div>

      {/* Cards — as mesmas colunas do Painel Comercial */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard titulo="Reuniões Agendadas" valor={String(reunioes.agendadas.length)} isLoading={reunioes.isLoading} />
        <KpiCard titulo="Reuniões Realizadas" valor={String(reunioes.realizadas.length)} isLoading={reunioes.isLoading} />
        <KpiCard titulo="No-Show" valor={String(reunioes.noShows.length)} isLoading={reunioes.isLoading} />
        <KpiCard titulo="Contrato Pago (agenda)" valor={String(reunioes.contratoPago.length)} isLoading={reunioes.isLoading} />
        <KpiCard
          titulo="Vendas Realizadas"
          valor={String(cotas?.vendas ?? 0)}
          detalhe={`${cotas?.cotas ?? 0} cotas`}
          isLoading={loadingCotas}
        />
        <KpiCard
          titulo="Consórcio Efetivado"
          valor={moeda(cotas?.credito ?? 0)}
          detalhe="Crédito das cotas contratadas"
          isLoading={loadingCotas}
        />
        <KpiCard
          titulo="Produção Gerada"
          valor={moeda(linhaProducao?.credito ?? 0)}
          detalhe={`${linhaProducao?.vendas ?? 0} vendas · ${linhaProducao?.cartas ?? 0} registros`}
          isLoading={loadingProducao}
        />
        <KpiCard
          titulo="Ticket médio da produção"
          valor={moeda(
            linhaProducao && linhaProducao.vendas > 0 ? linhaProducao.credito / linhaProducao.vendas : 0,
          )}
          isLoading={loadingProducao}
        />
      </div>

      <Tabs defaultValue="realizadas" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="realizadas">Reuniões Realizadas ({reunioes.realizadas.length})</TabsTrigger>
          <TabsTrigger value="noshows">No-Shows ({reunioes.noShows.length})</TabsTrigger>
          <TabsTrigger value="agendadas">Agendadas ({reunioes.agendadas.length})</TabsTrigger>
          <TabsTrigger value="contrato">Contrato Pago ({reunioes.contratoPago.length})</TabsTrigger>
          <TabsTrigger value="vendas">Vendas Realizadas ({cotas?.vendas ?? 0})</TabsTrigger>
          <TabsTrigger value="faturamento">Faturamento</TabsTrigger>
        </TabsList>

        <TabsContent value="realizadas">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <ReunioesTable itens={reunioes.realizadas} isLoading={reunioes.isLoading} onAbrirLead={abrirLead} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="noshows">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <ReunioesTable itens={reunioes.noShows} isLoading={reunioes.isLoading} onAbrirLead={abrirLead} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agendadas">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <ReunioesTable itens={reunioes.agendadas} isLoading={reunioes.isLoading} onAbrirLead={abrirLead} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contrato">
          <Card className="bg-card border-border">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Reuniões marcadas como contrato pago na agenda — não são a métrica de venda.
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <ReunioesTable itens={reunioes.contratoPago} isLoading={reunioes.isLoading} onAbrirLead={abrirLead} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vendas">
          <Card className="bg-card border-border">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                {cotas?.vendas ?? 0} vendas (clientes distintos) · {cotas?.cotas ?? 0} cotas ·{" "}
                {moeda(cotas?.credito ?? 0)} de crédito. A venda é contada por pessoa: uma pessoa com
                várias cotas é uma venda.
              </p>
              <CotasTable itens={cotas?.itens || []} isLoading={loadingCotas} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faturamento">
          <FaturamentoTab
            itens={itensProducao}
            producaoCredito={linhaProducao?.credito ?? 0}
            efetivadoCredito={cotas?.credito ?? 0}
            cotas={cotas?.cotas ?? 0}
            isLoading={loadingProducao || loadingCotas}
            onAbrirLead={abrirLead}
          />
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
