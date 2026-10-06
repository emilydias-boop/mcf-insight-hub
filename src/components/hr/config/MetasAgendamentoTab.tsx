import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, History, Loader2, AlertTriangle } from "lucide-react";

export type FonteMeta = "rh" | "rh_herdada" | "plano_ote" | "cadastro" | "sem_meta";

export interface MetaAgendamentoRow {
  sdr_id: string;
  nome: string | null;
  email: string | null;
  squad: string | null;
  employee_id: string | null;
  cargo: string | null;
  meta_diaria: number | null;
  fonte: FonteMeta;
  definida_no_mes: boolean;
  dias_uteis: number | null;
  meta_mes: number | null;
  pode_editar: boolean;
  atualizado_em: string | null;
}

export const FONTE_LABEL: Record<FonteMeta, string> = {
  rh: "Definida neste mês",
  rh_herdada: "Herdada do mês anterior",
  plano_ote: "Plano OTE antigo",
  cadastro: "Cadastro antigo",
  sem_meta: "Sem meta",
};

export function FonteBadge({ fonte }: { fonte: FonteMeta | null | undefined }) {
  const f = (fonte ?? "sem_meta") as FonteMeta;
  return (
    <Badge variant={f === "sem_meta" ? "destructive" : f === "rh" ? "default" : "secondary"}>
      {FONTE_LABEL[f] ?? f}
    </Badge>
  );
}

export function anoMesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftAnoMes(anoMes: string, delta: number): string {
  const [y, m] = anoMes.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nomeMes(anoMes: string): string {
  const [y, m] = anoMes.split("-").map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtDataHora(v: string | null | undefined): string {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function parseMeta(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, n));
}

export default function MetasAgendamentoTab() {
  const qc = useQueryClient();
  const [anoMes, setAnoMes] = useState(anoMesAtual());
  const [squad, setSquad] = useState<string>("__todas__");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const squadParam = squad === "__todas__" ? null : squad;

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["metas-agendamento", anoMes, squadParam],
    queryFn: async (): Promise<MetaAgendamentoRow[]> => {
      const { data, error } = await (supabase.rpc as any)("metas_agendamento_mes", { p_ano_mes: anoMes, p_squad: squadParam });
      if (error) throw error;
      return (data ?? []) as MetaAgendamentoRow[];
    },
  });

  // lista de squads sempre a partir do mês sem filtro
  const { data: todasRows = [] } = useQuery({
    queryKey: ["metas-agendamento", anoMes, null],
    queryFn: async (): Promise<MetaAgendamentoRow[]> => {
      const { data, error } = await (supabase.rpc as any)("metas_agendamento_mes", { p_ano_mes: anoMes, p_squad: null });
      if (error) throw error;
      return (data ?? []) as MetaAgendamentoRow[];
    },
  });
  const squads = useMemo(
    () => Array.from(new Set(todasRows.map((r) => r.squad).filter(Boolean) as string[])).sort(),
    [todasRows],
  );

  useEffect(() => { setEdits({}); }, [anoMes, squadParam]);

  const alterados = useMemo(() => {
    return rows
      .filter((r) => r.pode_editar && edits[r.sdr_id] !== undefined)
      .map((r) => ({ sdr_id: r.sdr_id, meta_diaria: parseMeta(edits[r.sdr_id]), original: r.meta_diaria }))
      .filter((x) => x.meta_diaria !== (x.original ?? null));
  }, [rows, edits]);

  const salvar = async () => {
    if (alterados.length === 0) return;
    setSalvando(true);
    try {
      const { data, error } = await (supabase.rpc as any)("salvar_metas_agendamento", {
        p_ano_mes: anoMes,
        p_itens: alterados.map(({ sdr_id, meta_diaria }) => ({ sdr_id, meta_diaria })),
      });
      if (error) throw error;
      toast.success(`${Number(data ?? alterados.length)} metas salvas`);
      setEdits({});
      await qc.invalidateQueries({ queryKey: ["metas-agendamento"] });
      await refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar metas");
    } finally {
      setSalvando(false);
    }
  };

  const semDiasUteis = rows.length > 0 && rows.some((r) => r.dias_uteis == null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setAnoMes(shiftAnoMes(anoMes, -1))} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[160px] text-center font-medium">{nomeMes(anoMes)}</span>
          <Button variant="outline" size="icon" onClick={() => setAnoMes(shiftAnoMes(anoMes, 1))} aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Select value={squad} onValueChange={setSquad}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="BU" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__todas__">Todas</SelectItem>
            {squads.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button variant="outline" onClick={() => setHistoricoOpen(true)}>
          <History className="h-4 w-4 mr-2" /> Histórico
        </Button>
        <Button onClick={salvar} disabled={alterados.length === 0 || salvando}>
          {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar alterações
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        A meta definida num mês vale também para os meses seguintes, até ser alterada. Dias úteis vêm do calendário do Fechamento.
      </p>
      {semDiasUteis && (
        <p className="text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> Dias úteis não encontrados: cadastre os dias úteis do mês.
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SDR</TableHead>
                  <TableHead>BU</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Meta diária</TableHead>
                  <TableHead>Dias úteis</TableHead>
                  <TableHead>Meta do mês</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Última alteração</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum SDR encontrado.</TableCell></TableRow>
                )}
                {rows.map((r) => {
                  const editado = edits[r.sdr_id];
                  const metaAtual = editado !== undefined ? parseMeta(editado) : r.meta_diaria;
                  const metaMes = r.dias_uteis == null || metaAtual == null ? null : metaAtual * r.dias_uteis;
                  return (
                    <TableRow key={r.sdr_id}>
                      <TableCell>
                        <div className="font-medium">{r.nome ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                      </TableCell>
                      <TableCell>{r.squad ?? "—"}</TableCell>
                      <TableCell>{r.cargo ?? "—"}</TableCell>
                      <TableCell>
                        {r.pode_editar ? (
                          <Input
                            type="number" min={0} max={100} step={1} className="w-24"
                            value={editado !== undefined ? editado : (r.meta_diaria ?? "").toString()}
                            onChange={(e) => setEdits((p) => ({ ...p, [r.sdr_id]: e.target.value }))}
                          />
                        ) : (
                          <span>{r.meta_diaria ?? "—"}</span>
                        )}
                      </TableCell>
                      <TableCell>{r.dias_uteis ?? "—"}</TableCell>
                      <TableCell>
                        {r.dias_uteis == null ? (
                          <span className="text-muted-foreground" title="cadastre os dias úteis do mês">— <span className="text-xs">(cadastre os dias úteis do mês)</span></span>
                        ) : (metaMes ?? "—")}
                      </TableCell>
                      <TableCell><FonteBadge fonte={r.fonte} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDataHora(r.atualizado_em)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <HistoricoDialog open={historicoOpen} onOpenChange={setHistoricoOpen} anoMes={anoMes} nomes={todasRows} />
    </div>
  );
}

function HistoricoDialog({ open, onOpenChange, anoMes, nomes }: {
  open: boolean; onOpenChange: (o: boolean) => void; anoMes: string; nomes: MetaAgendamentoRow[];
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["metas-agendamento-historico", anoMes],
    enabled: open,
    queryFn: async () => {
      const { data: hist, error } = await (supabase as any)
        .from("sdr_metas_mes_historico")
        .select("sdr_id, ano_mes, meta_anterior, meta_nova, acao, alterado_por, alterado_em")
        .eq("ano_mes", anoMes)
        .order("alterado_em", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((hist ?? []).map((h: any) => h.alterado_por).filter(Boolean))) as string[];
      let perfis: Record<string, string> = {};
      if (ids.length) {
        const { data: p } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        perfis = Object.fromEntries((p ?? []).map((x: any) => [x.id, x.full_name]));
      }
      return { hist: (hist ?? []) as any[], perfis };
    },
  });
  const nomeSdr = (id: string) => nomes.find((n) => n.sdr_id === id)?.nome ?? id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Histórico de metas — {nomeMes(anoMes)}</DialogTitle></DialogHeader>
        {isLoading ? (
          <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SDR</TableHead>
                  <TableHead>Anterior → Nova</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Quem alterou</TableHead>
                  <TableHead>Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.hist ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma alteração neste mês.</TableCell></TableRow>
                )}
                {(data?.hist ?? []).map((h, i) => (
                  <TableRow key={i}>
                    <TableCell>{nomeSdr(h.sdr_id)}</TableCell>
                    <TableCell>{h.meta_anterior ?? "—"} → {h.meta_nova ?? "—"}</TableCell>
                    <TableCell>{h.acao}</TableCell>
                    <TableCell>{(h.alterado_por && data?.perfis[h.alterado_por]) || "—"}</TableCell>
                    <TableCell className="text-xs">{fmtDataHora(h.alterado_em)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
