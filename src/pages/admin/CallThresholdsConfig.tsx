import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Phone, Plus, Trash2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  useAllCallClassificationThresholds,
  useUpsertCallThresholds,
  useDeleteCallThresholds,
  CallThresholds,
} from "@/hooks/useCallClassificationThresholds";
import { Skeleton } from "@/components/ui/skeleton";

const SQUAD_LABELS: Record<string, string> = {
  default: "Padrão (fallback)",
  incorporador: "Incorporador",
  consorcio: "Consórcio",
  marketing: "Marketing",
  inside: "Inside Sales",
};

function ThresholdForm({
  initial,
  onSubmit,
  submitLabel,
  disableSquad,
}: {
  initial: CallThresholds;
  onSubmit: (v: CallThresholds) => void;
  submitLabel: string;
  disableSquad?: boolean;
}) {
  const [form, setForm] = useState(initial);

  const valid = form.squad.trim().length > 0
    && form.ring_drop_max > 0
    && form.voicemail_max > form.ring_drop_max
    && form.effective_max > form.voicemail_max;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="squad">Squad / BU</Label>
        <Input
          id="squad"
          value={form.squad}
          onChange={(e) => setForm({ ...form, squad: e.target.value.toLowerCase().trim() })}
          placeholder="incorporador, consorcio, default..."
          disabled={disableSquad}
        />
        <p className="text-xs text-muted-foreground">
          Identificador minúsculo. Use <code>default</code> como fallback global.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Ring drop ≤ (s)</Label>
          <Input
            type="number" min={1}
            value={form.ring_drop_max}
            onChange={(e) => setForm({ ...form, ring_drop_max: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label>Caixa postal ≤ (s)</Label>
          <Input
            type="number" min={2}
            value={form.voicemail_max}
            onChange={(e) => setForm({ ...form, voicemail_max: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label>Efetiva ≤ (s)</Label>
          <Input
            type="number" min={3}
            value={form.effective_max}
            onChange={(e) => setForm({ ...form, effective_max: Number(e.target.value) })}
          />
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          As faixas devem ser crescentes: ring drop &lt; caixa postal &lt; efetiva.
          Tudo acima do limite de "efetiva" é classificado como <b>qualificada</b>.
        </AlertDescription>
      </Alert>

      <DialogFooter>
        <Button onClick={() => onSubmit(form)} disabled={!valid}>{submitLabel}</Button>
      </DialogFooter>
    </div>
  );
}

export default function CallThresholdsConfig() {
  const { data: rows, isLoading } = useAllCallClassificationThresholds();
  const upsert = useUpsertCallThresholds();
  const del = useDeleteCallThresholds();
  const [editing, setEditing] = useState<CallThresholds | null>(null);
  const [creating, setCreating] = useState(false);

  const sorted = useMemo(
    () => (rows || []).slice().sort((a, b) => (a.squad === 'default' ? -1 : b.squad === 'default' ? 1 : a.squad.localeCompare(b.squad))),
    [rows]
  );

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6" />
            Faixas de classificação de ligações
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Define, por BU, os limites de duração que classificam cada ligação outbound em
            ring drop, caixa postal, efetiva e qualificada.
          </p>
        </div>

        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nova BU</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar faixas para uma BU</DialogTitle>
              <DialogDescription>Defina o identificador do squad e as faixas em segundos.</DialogDescription>
            </DialogHeader>
            <ThresholdForm
              initial={{ squad: '', ring_drop_max: 10, voicemail_max: 30, effective_max: 60 }}
              submitLabel="Criar"
              onSubmit={async (v) => {
                await upsert.mutateAsync(v);
                setCreating(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configurações ativas</CardTitle>
          <CardDescription>
            Quando uma BU não tem registro próprio, o sistema cai no registro <code>default</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Squad / BU</TableHead>
                  <TableHead className="text-center">Não atendida</TableHead>
                  <TableHead className="text-center">Ring drop</TableHead>
                  <TableHead className="text-center">Caixa postal</TableHead>
                  <TableHead className="text-center">Efetiva</TableHead>
                  <TableHead className="text-center">Qualificada</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => (
                  <TableRow key={row.squad}>
                    <TableCell className="font-medium">
                      {SQUAD_LABELS[row.squad] || row.squad}
                      {row.squad === 'default' && (
                        <span className="ml-2 text-xs text-muted-foreground">(fallback)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">status fail/no-answer ou 0s</TableCell>
                    <TableCell className="text-center text-amber-600">1–{row.ring_drop_max}s</TableCell>
                    <TableCell className="text-center text-amber-700">{row.ring_drop_max + 1}–{row.voicemail_max}s</TableCell>
                    <TableCell className="text-center text-blue-600">{row.voicemail_max + 1}–{row.effective_max}s</TableCell>
                    <TableCell className="text-center text-green-600 font-semibold">&gt;{row.effective_max}s</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => setEditing(row)}>Editar</Button>
                      {row.squad !== 'default' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Remover faixas de "${row.squad}"? A BU passará a usar o padrão.`)) {
                              del.mutate(row.squad);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar faixas — {editing?.squad}</DialogTitle>
          </DialogHeader>
          {editing && (
            <ThresholdForm
              initial={editing}
              submitLabel="Salvar"
              disableSquad
              onSubmit={async (v) => {
                await upsert.mutateAsync(v);
                setEditing(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
