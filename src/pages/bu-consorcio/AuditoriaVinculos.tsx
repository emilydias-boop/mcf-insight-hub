import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useAjustesVinculo } from "@/hooks/useCorrigirVinculoCota";

const LABEL_ACAO: Record<string, string> = {
  pending_deal_link_changed: "Vínculo cota → lead alterado",
  pending_deal_link_created: "Cadastro criado e vinculado",
  attendee_booked_by_changed: "Agendador da reunião alterado",
};

/**
 * Revisão da gestão: toda correção manual de atribuição na BU Consórcio
 * (vínculo cota → lead e agendador da reunião), com autor, antes e depois.
 */
export default function AuditoriaVinculos() {
  const hoje = new Date();
  const [start, setStart] = useState(format(startOfMonth(hoje), "yyyy-MM-dd"));
  const [end, setEnd] = useState(format(endOfMonth(hoje), "yyyy-MM-dd"));
  const { data: rows = [], isLoading } = useAjustesVinculo(start, end);

  const porAcao = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.action, (m.get(r.action) || 0) + 1));
    return m;
  }, [rows]);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Correções de atribuição — Consórcio
        </h1>
        <p className="text-sm text-muted-foreground">
          Tudo que foi corrigido à mão nos resíduos do Painel Comercial: quem mexeu, quando, o que
          havia antes e o que passou a valer.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Período</CardTitle>
          <CardDescription className="text-xs">
            {rows.length} correção{rows.length === 1 ? "" : "ões"} no intervalo ·{" "}
            {[...porAcao.entries()].map(([a, n]) => `${LABEL_ACAO[a] || a}: ${n}`).join(" · ") || "nenhuma"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-40" />
          </div>
        </CardContent>
      </Card>

      <div className="border rounded-md overflow-auto">
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma correção manual registrada no período.
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Quem corrigiu</TableHead>
                <TableHead>O que mudou</TableHead>
                <TableHead>Antes</TableHead>
                <TableHead>Depois</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {format(new Date(r.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-sm">{r.autorNome}</TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline" className="mb-1">{LABEL_ACAO[r.action] || r.action}</Badge>
                    <div className="text-muted-foreground">{r.contexto}</div>
                  </TableCell>
                  <TableCell className="text-xs">{r.de}</TableCell>
                  <TableCell className="text-xs font-medium">{r.para}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}