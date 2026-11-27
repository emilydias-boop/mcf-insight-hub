import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useFunilLeads, formatBRL, formatInt, CANAL_LABELS, type EtapaLead, type FunilAnuncioRow, type FunilLeadRow, type ModeloData, type ModeloOrigem, type ModeloToque, type Nivel } from "@/hooks/useMarketingFunil";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const ETAPA_LABELS: Record<EtapaLead, string> = {
  entradas: "Entradas",
  r1_realizadas: "R1 realizadas",
  contratos: "Contratos",
  parcerias: "Parcerias",
};
const PLATAFORMA_LABELS: Record<string, string> = { hubla: "Hubla", mcfpay: "MCF Pay", kiwify: "Kiwify", make: "Integração (Make)", manual: "Lançamento manual" };
const TIPO_LABELS: Record<string, string> = {
  entrada_a010: "Entrada A010", entrada_outra: "Entrada", contrato: "Contrato",
  parceria: "Parceria", parceria_saldo: "Parceria (parcela)",
  estorno_contrato: "Estorno contrato", estorno_parceria: "Estorno parceria",
};
const TZ = "America/Sao_Paulo";
const dataCurta = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ }) : "—";
const dataHora = (iso: string | null) => iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const cell = "px-[12px] py-[10px] align-top";

// Aspas em tudo e fórmula de planilha neutralizada. Telefone (+55...) e valor negativo (-R$ 50,00) passam sem apóstrofo.
const formula = (value: string) => /^\s*[=@]/.test(value) || /^\s*[+-](?!\s*(R\$\s*)?[\d(])/.test(value);
const csvCell = (value: string) => `"${(formula(value) ? `'${value}` : value).replace(/"/g, '""')}"`;
function exportCsv(rows: FunilLeadRow[], nome: string, etapa: EtapaLead, from: string, to: string) {
  const header = ["Nome", "Telefone", "E-mail", "Entrou no CRM", "1º toque", "Canal", "Origem no CRM", "Detalhe da origem", "1º anúncio",
    `Data (${ETAPA_LABELS[etapa]})`, "SDR", "Closer R1", "Data R1", "Closer R2", "Data R2", "Quem vendeu", "Líquido no período", "Compras"];
  const lines = rows.map(r => [
    r.nome ?? "", r.telefone ?? "", r.email ?? "", dataCurta(r.entrou_crm_em), dataCurta(r.primeiro_toque_em),
    CANAL_LABELS[r.canal] ?? r.canal, r.origem_crm ?? "", r.origem_detalhe ?? "", r.anuncio ?? "",
    dataHora(r.etapa_em), r.sdr ?? "", r.closer_r1 ?? "", dataCurta(r.r1_em), r.closer_r2 ?? "", dataCurta(r.r2_em), r.vendedor ?? "",
    formatBRL(r.liquido_periodo),
    r.compras.map(c => `${dataCurta(c.data)} ${TIPO_LABELS[c.tipo] ?? c.tipo} ${c.produto ?? ""} ${PLATAFORMA_LABELS[c.plataforma ?? ""] ?? c.plataforma ?? ""} ${formatBRL(c.liquido)}`).join(" | "),
  ].map(csvCell).join(";"));
  const blob = new Blob(["\uFEFF", header.map(csvCell).join(";"), "\r\n", lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `leads-${etapa}-${normalize(nome).replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${from}_a_${to}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

interface LeadsDrilldownDialogProps {
  alvo: { row: FunilAnuncioRow; etapa: EtapaLead } | null;
  onClose: () => void;
  from: string; to: string; nivel: Nivel; data: ModeloData; toque: ModeloToque; origem: ModeloOrigem;
}

export function LeadsDrilldownDialog({ alvo: alvoAtual, onClose, from, to, nivel, data: modeloData, toque, origem }: LeadsDrilldownDialogProps) {
  const [busca, setBusca] = useState("");
  // Mantém o último alvo durante a animação de fechamento, para o conteúdo não piscar vazio.
  const [alvo, setAlvo] = useState(alvoAtual);
  useEffect(() => { if (alvoAtual) { setAlvo(alvoAtual); setBusca(""); } }, [alvoAtual]);
  const { data, isLoading, error } = useFunilLeads({
    from, to, nivel, data: modeloData, toque, origem,
    nivelId: alvo?.row.nivel_id ?? null, etapa: alvo?.etapa ?? null,
  });
  const filtradas = useMemo(() => {
    const needle = normalize(busca.trim());
    if (!needle) return data ?? [];
    return (data ?? []).filter(r => normalize([r.nome, r.email, r.telefone, r.sdr, r.closer_r1, r.closer_r2, r.vendedor].filter(Boolean).join(" ")).includes(needle));
  }, [data, busca]);
  const etapa = alvo?.etapa ?? "contratos";
  const esperado = alvo ? alvo.row[etapa] : 0;
  const mostraVendedor = etapa === "contratos" || etapa === "parcerias";

  return <Dialog open={!!alvoAtual} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="flex max-h-[90vh] w-[calc(100vw-32px)] max-w-[1280px] flex-col gap-[12px] overflow-hidden p-[20px]">
      <DialogHeader className="space-y-[6px] pr-[24px]">
        <DialogTitle className="text-[15px] leading-[1.4]">{ETAPA_LABELS[etapa]} · <span className="font-normal">{alvo?.row.nome}</span></DialogTitle>
        <DialogDescription className="text-[12px] leading-[1.5]">
          {formatInt(esperado)} {esperado === 1 ? "pessoa" : "pessoas"}, as mesmas contadas na tabela. "Quem vendeu" segue a regra do painel comercial
          (reunião em que o contrato foi marcado como pago; senão a R1 mais recente antes da venda; em parceria, o closer da R2) e é só informativo.
          "Líquido no período" é o que a pessoa somou nesta linha, igual à coluna Líquido.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap items-center gap-[12px]">
        <Input aria-label="Buscar lead" placeholder="Buscar por nome, telefone, e-mail, SDR ou closer" value={busca} onChange={e => setBusca(e.target.value)} className="h-[36px] min-w-[200px] flex-1 text-[12px] md:max-w-[380px]" />
        <Button variant="outline" disabled={isLoading || !!error || !filtradas.length} onClick={() => alvo && exportCsv(filtradas, alvo.row.nome, etapa, from, to)} className="h-[36px] gap-[8px] px-[12px] text-[12px]">
          <Download className="h-[14px] w-[14px]" />Exportar CSV
        </Button>
        {data && data.length !== esperado && <span className="text-[11px] text-amber-400">A lista tem {formatInt(data.length)} e a tabela {formatInt(esperado)}: a base atualiza de hora em hora, reabra a aba.</span>}
      </div>
      {/* Quem rola é a div interna do <Table> (shadcn): altura limitada para o cabeçalho ficar fixo e a barra horizontal visível. */}
      <div className="min-h-0 flex-1 [&>div]:max-h-[calc(90vh-230px)] [&>div]:overscroll-contain">
        {isLoading ? <div role="status" aria-label="Carregando leads" className="space-y-[8px]">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[44px] w-full" />)}</div>
          : error ? <Alert variant="destructive"><AlertDescription className="text-[12px]">{typeof error === "object" && "message" in error ? String(error.message) : String(error)}</AlertDescription></Alert>
          : !filtradas.length ? <p className="py-[24px] text-center text-[13px] text-muted-foreground">Nenhuma pessoa encontrada</p>
          : <Table className="min-w-[1180px] text-[12px]">
            <TableHeader><TableRow>
              {["Lead", "Entrou", "Origem", ETAPA_LABELS[etapa], "SDR · Closers", ...(mostraVendedor ? ["Quem vendeu"] : []), "Compras", "Líquido no período"].map(h =>
                <TableHead key={h} scope="col" className={`sticky top-0 z-10 bg-background px-[12px] py-[8px] text-[11px] ${h === "Líquido no período" ? "text-right" : ""}`}>{h}</TableHead>)}
            </TableRow></TableHeader>
            <TableBody>
              {filtradas.map(r => <TableRow key={r.person}>
                <TableCell className={`${cell} min-w-[180px] max-w-[240px]`}>
                  <p className="break-words font-medium">{r.nome ?? "Sem nome"}</p>
                  {r.telefone && <p className="tabular-nums text-muted-foreground">{r.telefone}</p>}
                  {r.email && <p className="break-all text-[11px] text-muted-foreground">{r.email}</p>}
                </TableCell>
                <TableCell className={`${cell} whitespace-nowrap`}>
                  <p>{dataCurta(r.entrou_crm_em)}</p>
                  {r.primeiro_toque_em && <p className="text-[11px] text-muted-foreground">1º toque {dataCurta(r.primeiro_toque_em)}</p>}
                </TableCell>
                <TableCell className={`${cell} min-w-[200px] max-w-[280px]`}>
                  <Badge variant="outline" className="px-[6px] py-[2px] text-[10px] font-normal">{CANAL_LABELS[r.canal] ?? r.canal}</Badge>
                  {r.origem_crm && <p className="mt-[4px] text-muted-foreground">CRM: {r.origem_crm}</p>}
                  {r.origem_detalhe && <p className="break-words text-[11px] text-muted-foreground">{r.origem_detalhe}</p>}
                  {r.anuncio && <p title={r.anuncio} className="line-clamp-2 break-words text-[11px] text-muted-foreground">1º anúncio: {r.anuncio}</p>}
                </TableCell>
                <TableCell className={`${cell} whitespace-nowrap tabular-nums`}>{dataHora(r.etapa_em)}</TableCell>
                <TableCell className={`${cell} min-w-[170px]`}>
                  <p><span className="text-muted-foreground">SDR:</span> {r.sdr ?? "—"}</p>
                  <p><span className="text-muted-foreground">R1:</span> {r.closer_r1 ?? "—"}{r.r1_em && <span className="text-[11px] text-muted-foreground"> · {dataCurta(r.r1_em)}</span>}</p>
                  <p><span className="text-muted-foreground">R2:</span> {r.closer_r2 ?? "—"}{r.r2_em && <span className="text-[11px] text-muted-foreground"> · {dataCurta(r.r2_em)}</span>}</p>
                </TableCell>
                {mostraVendedor && <TableCell className={`${cell} whitespace-nowrap font-medium`}>{r.vendedor ?? <span className="font-normal text-muted-foreground">Sem reunião</span>}</TableCell>}
                <TableCell className={`${cell} min-w-[260px]`}>
                  {r.compras.length ? <ul className="space-y-[4px]">{r.compras.map((c, i) => <li key={i} className={c.liquido < 0 ? "text-red-400" : ""}>
                    <span className="tabular-nums text-muted-foreground">{dataCurta(c.data)}</span> · {TIPO_LABELS[c.tipo] ?? c.tipo}
                    {c.produto && <span className="text-muted-foreground"> ({c.produto})</span>}
                    {" · "}{PLATAFORMA_LABELS[c.plataforma ?? ""] ?? c.plataforma ?? "—"}
                    {" · "}<span className="tabular-nums">{formatBRL(c.liquido)}</span>
                    {c.bruto !== null && <span className="text-[11px] text-muted-foreground"> (bruto {formatBRL(c.bruto)}{c.parcelas && c.parcelas > 1 ? `, parcela ${c.parcela ?? 1}/${c.parcelas}` : ""})</span>}
                  </li>)}</ul> : <span className="text-muted-foreground">Sem compra</span>}
                </TableCell>
                <TableCell className={`${cell} whitespace-nowrap text-right tabular-nums`}>{formatBRL(r.liquido_periodo)}</TableCell>
              </TableRow>)}
            </TableBody>
          </Table>}
      </div>
    </DialogContent>
  </Dialog>;
}
