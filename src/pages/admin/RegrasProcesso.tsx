import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Settings2, ClipboardList, History, Check, X, Loader2, Info, Sparkles, ChevronDown, ChevronRight, User, Phone, MapPin, Calendar, Package } from "lucide-react";
import { NoShowAISettingsCard } from "@/components/admin/NoShowAISettingsCard";
import { toast } from "sonner";
import { BU_OPTIONS, BusinessUnit } from "@/hooks/useMyBU";
import {
  useAllProcessRules,
  useUpsertProcessRule,
  RULE_KEYS,
  ProcessRuleRole,
} from "@/hooks/useProcessRules";
import {
  usePendingApprovals,
  useApprovalHistory,
  useReviewApprovalRequest,
  ApprovalRequest,
  useEnrichedPendingApprovals,
  EnrichedApproval,
} from "@/hooks/useApprovalRequests";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const RULE_LABELS: Record<string, { title: string; description: string; type: "number" | "approvers" }> = {
  [RULE_KEYS.MAX_MEETINGS]: {
    title: "Limite de agendamentos contabilizados",
    description: "Máximo de agendamentos R1/R2 que contam para a meta no mesmo lead/semana. Vazio = ilimitado.",
    type: "number",
  },
  [RULE_KEYS.MAX_NOSHOWS]: {
    title: "Limite de no-shows contabilizados",
    description: "Máximo de no-shows que contam contra o usuário no mesmo lead. Vazio = ilimitado.",
    type: "number",
  },
  [RULE_KEYS.RESCHEDULE_APPROVAL]: {
    title: "Aprovação de reagendamento",
    description: "A partir de qual reagendamento (3º, 4º…) o sistema exige aprovação. Vazio = sem aprovação.",
    type: "number",
  },
  [RULE_KEYS.APPROVERS]: {
    title: "Cargos que aprovam",
    description: "Quais cargos podem aprovar pedidos pendentes (admin, coordenador, manager).",
    type: "approvers",
  },
};

const RULE_ORDER = [
  RULE_KEYS.MAX_MEETINGS,
  RULE_KEYS.MAX_NOSHOWS,
  RULE_KEYS.RESCHEDULE_APPROVAL,
  RULE_KEYS.APPROVERS,
];

const BU_VALUES: Array<{ value: string | null; label: string }> = [
  { value: null, label: "🌐 Global (padrão)" },
  ...BU_OPTIONS.filter((o) => o.value !== "").map((o) => ({
    value: o.value as string,
    label: o.label,
  })),
];

function ruleValueDisplay(key: string, val: any): string {
  if (!val) return "—";
  if (key === RULE_KEYS.APPROVERS) {
    const roles: string[] = val.roles || [];
    return roles.length ? roles.join(", ") : "—";
  }
  const v = val.value;
  if (v === null || v === undefined) return "Ilimitado / Desativado";
  return String(v);
}

/**
 * Traduz o payload técnico do pedido em uma descrição amigável para o gestor.
 */
function formatPayloadHumano(ruleKey: string, payload: any): {
  resumo: string;
  lead?: string;
  motivo?: string;
} {
  if (!payload || typeof payload !== "object") {
    return { resumo: "Sem detalhes adicionais." };
  }

  const lead =
    payload.deal_name ||
    payload.contact_name ||
    (payload.deal_id ? `Lead #${String(payload.deal_id).slice(0, 8)}` : undefined);

  if (ruleKey === RULE_KEYS.RESCHEDULE_APPROVAL) {
    const tentativa = payload.reschedule_count;
    // Se reschedule_count = 2, é a 3ª tentativa (limite costuma ser 3)
    const ordinal = typeof tentativa === "number" ? `${tentativa + 1}º` : "novo";
    return {
      resumo: `Solicita autorização para realizar o ${ordinal} reagendamento deste lead, acima do limite permitido.`,
      lead,
      motivo: payload.reason,
    };
  }

  if (ruleKey === RULE_KEYS.MAX_MEETINGS) {
    return {
      resumo: `Solicita contabilizar uma reunião adicional acima do limite definido.`,
      lead,
      motivo: payload.reason,
    };
  }

  if (ruleKey === RULE_KEYS.MAX_NOSHOWS) {
    return {
      resumo: `Solicita registrar mais um no-show neste lead, acima do limite definido.`,
      lead,
      motivo: payload.reason,
    };
  }

  return {
    resumo: payload.reason || "Solicitação de exceção a uma regra de processo.",
    lead,
  };
}

export default function RegrasProcesso() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Regras de Processo</h1>
        <p className="text-muted-foreground">
          Controle limites operacionais (agendamentos, no-shows, aprovações de reagendamento) por BU e cargo.
        </p>
      </div>

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules" className="gap-2">
            <Settings2 className="h-4 w-4" /> Regras por BU + Cargo
          </TabsTrigger>
          <TabsTrigger value="no_show_ai" className="gap-2">
            <Sparkles className="h-4 w-4" /> No-Show + IA
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2">
            <ClipboardList className="h-4 w-4" /> Aprovações Pendentes
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          <RulesMatrixTab />
        </TabsContent>
        <TabsContent value="no_show_ai">
          <NoShowAISettingsCard />
        </TabsContent>
        <TabsContent value="pending">
          <PendingTab />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Rules matrix ---------------- */
function RulesMatrixTab() {
  const { data: allRules = [], isLoading } = useAllProcessRules();
  const [selectedBU, setSelectedBU] = useState<string | null>(null);

  const rulesByKey = useMemo(() => {
    const map: Record<string, { sdr: any; closer: any }> = {};
    for (const k of RULE_ORDER) {
      const sdr =
        allRules.find((r) => r.bu === selectedBU && r.role === "sdr" && r.rule_key === k) ||
        allRules.find((r) => r.bu === null && r.role === "sdr" && r.rule_key === k);
      const closer =
        allRules.find((r) => r.bu === selectedBU && r.role === "closer" && r.rule_key === k) ||
        allRules.find((r) => r.bu === null && r.role === "closer" && r.rule_key === k);
      map[k] = { sdr, closer };
    }
    return map;
  }, [allRules, selectedBU]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Selecione o escopo</CardTitle>
          <CardDescription>
            Edite a regra global ou crie/sobrescreva por BU. Regras de BU sempre têm prioridade sobre a global.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {BU_VALUES.map((b) => (
              <Button
                key={b.value ?? "global"}
                variant={selectedBU === b.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedBU(b.value)}
              >
                {b.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando regras…
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              Regras —{" "}
              {selectedBU
                ? BU_VALUES.find((b) => b.value === selectedBU)?.label
                : "Global (padrão)"}
            </CardTitle>
            <CardDescription>
              <Info className="inline h-3 w-3 mr-1" />
              Quando o valor herda da regra global, salvar cria uma sobrescrita específica desta BU.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Regra</TableHead>
                  <TableHead>SDR</TableHead>
                  <TableHead>Closer</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {RULE_ORDER.map((key) => (
                  <RuleRow
                    key={key}
                    ruleKey={key}
                    bu={selectedBU}
                    sdrRule={rulesByKey[key]?.sdr}
                    closerRule={rulesByKey[key]?.closer}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RuleRow({
  ruleKey,
  bu,
  sdrRule,
  closerRule,
}: {
  ruleKey: string;
  bu: string | null;
  sdrRule: any;
  closerRule: any;
}) {
  const [editing, setEditing] = useState<null | { role: ProcessRuleRole; rule: any }>(null);
  const meta = RULE_LABELS[ruleKey];

  const sdrInherited = sdrRule?.bu !== bu;
  const closerInherited = closerRule?.bu !== bu;

  const formatAppliesFrom = (iso?: string | null) => {
    if (!iso) return null;
    try {
      return format(new Date(iso), "dd/MM/yy HH:mm", { locale: ptBR });
    } catch {
      return null;
    }
  };

  return (
    <>
      <TableRow>
        <TableCell>
          <div className="font-medium">{meta.title}</div>
          <div className="text-xs text-muted-foreground max-w-md">{meta.description}</div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">
              {ruleValueDisplay(ruleKey, sdrRule?.rule_value)}
            </span>
            {sdrInherited && (
              <Badge variant="outline" className="text-xs">
                herdado
              </Badge>
            )}
          </div>
          {sdrRule?.applies_from && ruleKey !== RULE_KEYS.APPROVERS && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Vale desde: {formatAppliesFrom(sdrRule.applies_from)}
            </div>
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">
              {ruleValueDisplay(ruleKey, closerRule?.rule_value)}
            </span>
            {closerInherited && (
              <Badge variant="outline" className="text-xs">
                herdado
              </Badge>
            )}
          </div>
          {closerRule?.applies_from && ruleKey !== RULE_KEYS.APPROVERS && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Vale desde: {formatAppliesFrom(closerRule.applies_from)}
            </div>
          )}
        </TableCell>
        <TableCell>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing({ role: "sdr", rule: sdrRule })}>
              Editar SDR
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing({ role: "closer", rule: closerRule })}>
              Editar Closer
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {editing && (
        <EditRuleDialog
          ruleKey={ruleKey}
          bu={bu}
          role={editing.role}
          currentValue={editing.rule?.rule_value}
          currentAppliesFrom={editing.rule?.applies_from}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function EditRuleDialog({
  ruleKey,
  bu,
  role,
  currentValue,
  currentAppliesFrom,
  onClose,
}: {
  ruleKey: string;
  bu: string | null;
  role: ProcessRuleRole;
  currentValue: any;
  currentAppliesFrom?: string | null;
  onClose: () => void;
}) {
  const meta = RULE_LABELS[ruleKey];
  const upsert = useUpsertProcessRule();

  const [numValue, setNumValue] = useState<string>(() => {
    const v = currentValue?.value;
    return v === null || v === undefined ? "" : String(v);
  });
  const [approvers, setApprovers] = useState<string[]>(() => currentValue?.roles || ["admin"]);
  // Default vigência: agora (regra não-retroativa). Se já existir, mantém.
  const [appliesFromLocal, setAppliesFromLocal] = useState<string>(() => {
    const base = currentAppliesFrom ? new Date(currentAppliesFrom) : new Date();
    // formato datetime-local: YYYY-MM-DDTHH:mm
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}`;
  });

  const handleSave = async () => {
    let rule_value: any;
    if (meta.type === "number") {
      const trimmed = numValue.trim();
      const parsed = trimmed === "" ? null : Number(trimmed);
      if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
        toast.error("Informe um número inteiro >= 0 ou deixe vazio");
        return;
      }
      rule_value = { value: parsed };
    } else {
      rule_value = { roles: approvers };
    }

    try {
      const appliesFromIso =
        meta.type === "number" && appliesFromLocal
          ? new Date(appliesFromLocal).toISOString()
          : undefined;
      await upsert.mutateAsync({
        bu,
        role,
        rule_key: ruleKey,
        rule_value,
        applies_from: appliesFromIso,
      });
      toast.success("Regra atualizada");
      onClose();
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message ?? err}`);
    }
  };

  const APPROVER_OPTIONS = ["admin", "coordenador", "manager"];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {meta.title} — {role.toUpperCase()}
          </DialogTitle>
          <DialogDescription>
            Escopo: <strong>{bu ? bu : "Global"}</strong>. {meta.description}
          </DialogDescription>
        </DialogHeader>

        {meta.type === "number" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Valor (vazio = desativado/ilimitado)</Label>
              <Input
                type="number"
                min={0}
                value={numValue}
                onChange={(e) => setNumValue(e.target.value)}
                placeholder="Ex: 2"
              />
            </div>
            <div className="space-y-2">
              <Label>Vale a partir de</Label>
              <Input
                type="datetime-local"
                value={appliesFromLocal}
                onChange={(e) => setAppliesFromLocal(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A regra ignora movimentos anteriores a esta data (não-retroativa).
                Default: agora.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Cargos que podem aprovar</Label>
            <div className="flex flex-col gap-2">
              {APPROVER_OPTIONS.map((r) => (
                <label key={r} className="flex items-center gap-2 cursor-pointer">
                  <Switch
                    checked={approvers.includes(r)}
                    onCheckedChange={(checked) =>
                      setApprovers((prev) =>
                        checked ? [...new Set([...prev, r])] : prev.filter((x) => x !== r),
                      )
                    }
                  />
                  <span className="capitalize">{r}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Pending approvals ---------------- */
function PendingTab() {
  const { data: pending = [], isLoading } = usePendingApprovals();
  const { data: enriched = [], isLoading: loadingEnriched } =
    useEnrichedPendingApprovals(pending);
  const review = useReviewApprovalRequest();
  const [reviewing, setReviewing] = useState<{ req: ApprovalRequest; action: "approved" | "rejected" } | null>(null);
  const [notes, setNotes] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const handleConfirm = async () => {
    if (!reviewing) return;
    try {
      await review.mutateAsync({ id: reviewing.req.id, action: reviewing.action, notes });
      toast.success(reviewing.action === "approved" ? "Pedido aprovado" : "Pedido rejeitado");
      setReviewing(null);
      setNotes("");
    } catch (err: any) {
      toast.error(`Erro: ${err.message ?? err}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pedidos pendentes</CardTitle>
        <CardDescription>
          Solicitações de SDR/Closer para ações que excederam algum limite configurado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading || (pending.length > 0 && loadingEnriched) ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : pending.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            Nenhum pedido pendente. ✨
          </div>
        ) : (
          <div className="space-y-3">
            {enriched.map((req) => (
              <PendingApprovalCard
                key={req.id}
                req={req}
                expanded={!!expanded[req.id]}
                onToggle={() =>
                  setExpanded((s) => ({ ...s, [req.id]: !s[req.id] }))
                }
                onApprove={() => setReviewing({ req, action: "approved" })}
                onReject={() => setReviewing({ req, action: "rejected" })}
              />
            ))}
          </div>
        )}
      </CardContent>

      {reviewing && (
        <Dialog open onOpenChange={(o) => !o && setReviewing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {reviewing.action === "approved" ? "Aprovar pedido" : "Rejeitar pedido"}
              </DialogTitle>
              <DialogDescription>Adicione uma observação (opcional).</DialogDescription>
            </DialogHeader>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações para o solicitante…"
              rows={3}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewing(null)}>
                Cancelar
              </Button>
              <Button
                variant={reviewing.action === "approved" ? "default" : "destructive"}
                onClick={handleConfirm}
                disabled={review.isPending}
              >
                {review.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

/* ---------------- History ---------------- */
function HistoryTab() {
  const { data: history = [], isLoading } = useApprovalHistory();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de decisões</CardTitle>
        <CardDescription>Últimos 100 pedidos resolvidos.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : history.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">Sem histórico.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>BU</TableHead>
                <TableHead>Solicitante</TableHead>
                <TableHead>Regra</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="text-xs">
                    {req.reviewed_at
                      ? format(new Date(req.reviewed_at), "dd/MM HH:mm", { locale: ptBR })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{req.bu ?? "global"}</Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{req.requested_by.slice(0, 8)}</TableCell>
                  <TableCell className="text-xs">{RULE_LABELS[req.rule_key]?.title ?? req.rule_key}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        req.status === "approved"
                          ? "default"
                          : req.status === "rejected"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {req.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs max-w-md">{req.review_notes || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
