import { useState, useRef, useEffect } from "react";
import { Loader2, Upload, AlertTriangle, CheckCircle2, XCircle, HelpCircle, Image as ImageIcon, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

type Verdict = "confirmed" | "not_no_show" | "inconclusive" | "error";

interface CriteriaMet {
  identity_match: boolean;
  vendor_message_no_response: boolean;
  timing_close_to_meeting: boolean;
  lead_confirmed_absence: boolean;
}

interface AIResult {
  verdict: Verdict;
  reasoning: string;
  extracted_phone: string;
  conversation_summary: string;
  criteria_met?: CriteriaMet;
  phone_match: boolean | null;
  lead_phone_normalized: string | null;
  extracted_phone_normalized: string | null;
  prior_no_shows?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadPhone?: string | null;
  leadName?: string | null;
  dealId?: string | null;
  meetingSlotId?: string | null;
  attendeeId?: string | null;
  meetingScheduledAt?: string | null;
  buOriginId?: string | null;
  performedByRole?: string | null;
  meetingType?: "R1" | "R2";
  onConfirm: () => Promise<void> | void;
  confirmLoading?: boolean;
}

const verdictConfig: Record<Verdict, { label: string; icon: typeof CheckCircle2; color: string; description: string }> = {
  confirmed: {
    label: "IA confirmou: No-Show legítimo",
    icon: CheckCircle2,
    color: "text-emerald-700 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-300",
    description: "A conversa atende aos critérios de no-show.",
  },
  not_no_show: {
    label: "IA discorda: NÃO parece No-Show",
    icon: XCircle,
    color: "text-red-700 border-red-500 bg-red-50 dark:bg-red-950/30 dark:text-red-300",
    description: "A IA bloqueou esta marcação. Você pode contestar com justificativa para revisão do gestor.",
  },
  inconclusive: {
    label: "IA inconclusiva — precisa de justificativa",
    icon: HelpCircle,
    color: "text-yellow-700 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-300",
    description: "Print sem contexto suficiente. Justifique para registrar o no-show.",
  },
  error: {
    label: "Falha na análise",
    icon: AlertTriangle,
    color: "text-muted-foreground border-border bg-muted",
    description: "Houve um erro ao processar o print.",
  },
};

const CRITERIA_LABELS: Record<keyof CriteriaMet, string> = {
  identity_match: "Telefone/nome bate com o lead",
  vendor_message_no_response: "Mensagem do vendedor sem resposta (ou ausência confirmada)",
  timing_close_to_meeting: "Mensagens próximas ao horário da reunião",
  lead_confirmed_absence: "Lead confirmou que não compareceria",
};

export function NoShowEvidenceDialog({
  open,
  onOpenChange,
  leadPhone,
  leadName,
  dealId,
  meetingSlotId,
  attendeeId,
  meetingScheduledAt,
  buOriginId,
  performedByRole,
  meetingType = "R1",
  onConfirm,
  confirmLoading,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [evidencePath, setEvidencePath] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [sdrJustification, setSdrJustification] = useState("");
  const [committing, setCommitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreviewUrl(null);
      setEvidencePath(null);
      setAiResult(null);
      setAiError(null);
      setSdrJustification("");
      setAnalyzing(false);
      setUploading(false);
      setCommitting(false);
    }
  }, [open]);

  const handleFileSelect = async (selected: File) => {
    if (!selected.type.startsWith("image/")) {
      toast.error("Envie uma imagem (PNG, JPG, etc).");
      return;
    }
    if (selected.size > 8 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 8MB).");
      return;
    }
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setAiResult(null);
    setAiError(null);
    setSdrJustification("");

    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Sessão inválida");
      const ext = selected.name.split(".").pop() || "png";
      const path = `${uid}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("no-show-evidence")
        .upload(path, selected, { contentType: selected.type, upsert: false });
      if (upErr) throw upErr;
      setEvidencePath(path);

      setAnalyzing(true);
      const { data: aiData, error: aiErr } = await supabase.functions.invoke(
        "validate-no-show-evidence",
        {
          body: {
            evidence_path: path,
            lead_phone: leadPhone ?? null,
            lead_name: leadName ?? null,
            meeting_scheduled_at: meetingScheduledAt ?? null,
            meeting_type: meetingType,
            deal_id: dealId,
          },
        }
      );
      if (aiErr) throw aiErr;
      if (aiData?.error) throw new Error(aiData.error);
      setAiResult(aiData as AIResult);
    } catch (e: any) {
      console.error(e);
      setAiError(e.message || "Erro ao processar evidência");
      toast.error(e.message || "Erro ao processar evidência");
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const verdict = aiResult?.verdict ?? null;
  const cfg = verdict ? verdictConfig[verdict] : null;
  const VerdictIcon = cfg?.icon;

  const isInconclusive = verdict === "inconclusive";
  const isContest = verdict === "not_no_show";
  const minJustifLen = isContest ? 20 : 10;
  const justifValid = sdrJustification.trim().length >= minJustifLen;

  const handleConfirm = async () => {
    if (!evidencePath || !aiResult) {
      toast.error("Anexe um print antes de confirmar.");
      return;
    }
    if ((isInconclusive || isContest) && !justifValid) {
      toast.error(`Justifique em pelo menos ${minJustifLen} caracteres.`);
      return;
    }

    setCommitting(true);
    try {
      const { data: commitData, error: commitErr } = await supabase.functions.invoke(
        "validate-no-show-evidence",
        {
          body: {
            action: "commit",
            evidence_path: evidencePath,
            lead_phone: leadPhone ?? null,
            lead_name: leadName ?? null,
            meeting_scheduled_at: meetingScheduledAt ?? null,
            meeting_type: meetingType,
            deal_id: dealId,
            meeting_slot_id: meetingSlotId,
            attendee_id: attendeeId,
            bu_origin_id: buOriginId,
            performed_by_role: performedByRole,
            human_decision: "no_show",
            sdr_justification: (isInconclusive || isContest) ? sdrJustification : null,
            contest: isContest,
          },
        }
      );
      if (commitErr) {
        toast.error(commitErr.message || "Falha ao registrar validação");
        return;
      }
      if (commitData?.error) {
        toast.error(commitData.error);
        return;
      }

      // Se foi contestação → não tenta marcar no_show ainda (aguarda gestor)
      if (commitData?.final_status === "pending_review") {
        toast.success("Contestação enviada para revisão do gestor.");
        onOpenChange(false);
        return;
      }

      try {
        await onConfirm();
      } catch (e: any) {
        toast.error(e?.message || "Falha ao marcar No-Show");
      }
    } finally {
      setCommitting(false);
    }
  };

  const buttonDisabled =
    !aiResult ||
    uploading ||
    analyzing ||
    confirmLoading ||
    committing ||
    ((isInconclusive || isContest) && !justifValid);

  const buttonLabel = isContest
    ? "Enviar contestação para gestor"
    : "Confirmar No-Show";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Marcar No-Show {meetingType} com evidência
          </DialogTitle>
          <DialogDescription>
            Anexe um print da conversa onde fica claro o no-show. A IA validará telefone,
            tentativa de contato e janela temporal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!file && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">Clique para enviar o print</span>
              <span className="text-xs text-muted-foreground">PNG, JPG até 8MB</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
            }}
          />

          {file && previewUrl && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border overflow-hidden bg-muted">
                <img src={previewUrl} alt="Print" className="max-h-64 w-full object-contain" />
              </div>
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground truncate flex-1">{file.name}</span>
                <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
                  Trocar
                </Button>
              </div>
            </div>
          )}

          {(uploading || analyzing) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {uploading ? "Enviando print..." : "IA analisando a conversa..."}
            </div>
          )}

          {aiError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{aiError}</AlertDescription>
            </Alert>
          )}

          {aiResult && cfg && VerdictIcon && (
            <div className={`rounded-lg border p-4 space-y-3 ${cfg.color}`}>
              <div className="flex items-start gap-2">
                <VerdictIcon className="h-5 w-5 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-sm">{cfg.label}</div>
                  <div className="text-xs opacity-80 mt-0.5">{cfg.description}</div>
                </div>
              </div>

              <div className="text-xs space-y-1.5 text-foreground/90">
                <div>
                  <span className="font-medium">Resumo:</span> {aiResult.conversation_summary}
                </div>
                <div>
                  <span className="font-medium">Análise:</span> {aiResult.reasoning}
                </div>

                {aiResult.criteria_met && (
                  <div className="pt-2 space-y-1">
                    <div className="font-medium">Critérios verificados:</div>
                    {Object.entries(aiResult.criteria_met).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2">
                        {v ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-500" />
                        )}
                        <span>{CRITERIA_LABELS[k as keyof CriteriaMet]}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant="outline" className="text-xs">
                    Tel. CRM: {aiResult.lead_phone_normalized || "—"}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Tel. print: {aiResult.extracted_phone_normalized || "não detectado"}
                  </Badge>
                  {aiResult.phone_match === true && (
                    <Badge className="bg-emerald-600 text-xs">✓ Telefones batem</Badge>
                  )}
                  {aiResult.phone_match === false && (
                    <Badge variant="destructive" className="text-xs">⚠ Telefones diferentes</Badge>
                  )}
                  {typeof aiResult.prior_no_shows === "number" && aiResult.prior_no_shows > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {aiResult.prior_no_shows} no-show(s) anterior(es)
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          {isInconclusive && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Justifique o no-show (mín. 10 caracteres) <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={sdrJustification}
                onChange={(e) => setSdrJustification(e.target.value)}
                placeholder="Ex: lead disse no início que viria, mas não respondeu mais. Print não pegou todo o histórico."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Sua justificativa fica registrada para auditoria.
              </p>
            </div>
          )}

          {isContest && (
            <div className="space-y-2 rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950/20 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-orange-700 dark:text-orange-300">
                <ShieldAlert className="h-4 w-4" />
                Contestar decisão da IA
              </div>
              <p className="text-xs text-orange-700/80 dark:text-orange-300/80">
                A IA bloqueou. Você pode enviar uma contestação com justificativa detalhada
                (mín. 20 caracteres) para o coordenador/admin revisar e decidir.
              </p>
              <Textarea
                value={sdrJustification}
                onChange={(e) => setSdrJustification(e.target.value)}
                placeholder="Explique em detalhe por que ainda é no-show, o que a IA não conseguiu enxergar no print, contexto adicional..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {sdrJustification.trim().length}/20 caracteres mínimos
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirmLoading || committing}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={buttonDisabled}
            className={isContest ? "bg-orange-600 hover:bg-orange-700" : "bg-yellow-600 hover:bg-yellow-700"}
          >
            {(confirmLoading || committing) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {buttonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
