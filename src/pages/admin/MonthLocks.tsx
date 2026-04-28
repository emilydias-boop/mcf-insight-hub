import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Lock, Unlock, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAllMonthLocks } from "@/hooks/useMonthLock";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function MonthLocksPage() {
  const { data: locks, isLoading } = useAllMonthLocks();
  const queryClient = useQueryClient();

  const [newAnoMes, setNewAnoMes] = useState("");
  const [newReason, setNewReason] = useState("");
  const [creating, setCreating] = useState(false);

  const [unlockTarget, setUnlockTarget] = useState<{ id: string; ano_mes: string } | null>(null);
  const [unlockReason, setUnlockReason] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["month-locks-all"] });
    queryClient.invalidateQueries({ queryKey: ["month-lock"] });
  };

  const handleCreate = async () => {
    if (!/^\d{4}-\d{2}$/.test(newAnoMes)) {
      toast({ title: "Formato inválido", description: "Use YYYY-MM (ex: 2026-03).", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { error } = await supabase.rpc("lock_month", {
      _ano_mes: newAnoMes,
      _reason: newReason || "Trava manual",
    });
    setCreating(false);
    if (error) {
      toast({ title: "Erro ao travar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Mês travado", description: `${newAnoMes} agora está fechado.` });
    setNewAnoMes("");
    setNewReason("");
    refresh();
  };

  const handleUnlock = async () => {
    if (!unlockTarget) return;
    if (!unlockReason.trim()) {
      toast({ title: "Informe o motivo", description: "Justifique a reabertura.", variant: "destructive" });
      return;
    }
    setUnlocking(true);
    const { error } = await supabase
      .from("meeting_status_locks")
      .update({
        is_active: false,
        unlocked_at: new Date().toISOString(),
        unlocked_reason: unlockReason,
      })
      .eq("id", unlockTarget.id);
    setUnlocking(false);
    if (error) {
      toast({ title: "Erro ao reabrir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Mês reaberto", description: `${unlockTarget.ano_mes} liberado para edição.` });
    setUnlockTarget(null);
    setUnlockReason("");
    refresh();
  };

  const handleRelock = async (anoMes: string) => {
    const { error } = await supabase.rpc("lock_month", {
      _ano_mes: anoMes,
      _reason: "Retravado manualmente",
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Mês travado novamente", description: anoMes });
    refresh();
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Lock className="h-6 w-6" /> Travas de Fechamento Mensal
        </h1>
        <p className="text-muted-foreground">
          Quando um mês é travado, alterações de status em reuniões daquele mês ficam bloqueadas
          (exceto Admin, Manager e Coordenador).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Travar mês manualmente</CardTitle>
          <CardDescription>
            Travas são criadas automaticamente quando um fechamento (SDR ou Closer) é Aprovado.
            Use este formulário apenas se quiser travar antecipadamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="ano_mes">Mês (YYYY-MM)</Label>
              <Input
                id="ano_mes"
                placeholder="2026-03"
                value={newAnoMes}
                onChange={(e) => setNewAnoMes(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="reason">Motivo</Label>
              <Input
                id="reason"
                placeholder="Ex: Fechamento concluído manualmente"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={creating}>
            <Lock className="h-4 w-4 mr-2" /> {creating ? "Travando..." : "Travar mês"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de travas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : !locks?.length ? (
            <p className="text-muted-foreground">Nenhuma trava registrada.</p>
          ) : (
            <div className="space-y-3">
              {locks.map((l) => (
                <div
                  key={l.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-3 border rounded-md p-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span className="font-medium">{l.ano_mes}</span>
                      {l.is_active ? (
                        <Badge variant="destructive">Travado</Badge>
                      ) : (
                        <Badge variant="secondary">Reaberto</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {l.locked_reason || "—"} ·{" "}
                      {format(new Date(l.locked_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                    {!l.is_active && l.unlocked_at && (
                      <p className="text-sm text-muted-foreground">
                        Reaberto em{" "}
                        {format(new Date(l.unlocked_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        {l.unlocked_reason ? ` — ${l.unlocked_reason}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {l.is_active ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setUnlockTarget({ id: l.id, ano_mes: l.ano_mes })}
                      >
                        <Unlock className="h-4 w-4 mr-2" /> Reabrir
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => handleRelock(l.ano_mes)}>
                        <Lock className="h-4 w-4 mr-2" /> Travar novamente
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!unlockTarget} onOpenChange={(o) => !o && setUnlockTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir mês {unlockTarget?.ano_mes}</DialogTitle>
            <DialogDescription>
              A reabertura permite alterações de status em reuniões deste mês. Esta ação fica
              registrada no histórico.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="unlock_reason">Motivo da reabertura *</Label>
            <Textarea
              id="unlock_reason"
              placeholder="Ex: Correção de no-show indevido"
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUnlockTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={handleUnlock} disabled={unlocking}>
              {unlocking ? "Reabrindo..." : "Confirmar reabertura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}