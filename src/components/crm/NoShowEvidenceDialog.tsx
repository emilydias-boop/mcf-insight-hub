import { useState, useRef, useEffect } from "react";
import { Loader2, Upload, AlertTriangle, CheckCircle2, XCircle, HelpCircle, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

type Verdict = "confirmed_no_show" | "not_no_show" | "uncertain" | "error";

interface AIResult {
  verdict: Verdict;
  reasoning: string;
  extracted_phone: string;
  conversation_summary: string;
  phone_match: boolean | null;
  lead_phone_normalized: string | null;
  extracted_phone_normalized: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Telefone do lead (qualquer formato, será normalizado) */
  leadPhone?: string | null;
  leadName?: string | null;
  dealId?: string | null;
  meetingSlotId?: string | null;
  attendeeId?: string | null;
  meetingScheduledAt?: string | null;
  buOriginId?: string | null;
  performedByRole?: string | null;
  /** Chamado quando o usuário confirma o No-Show. Deve marcar de fato no banco. */
  onConfirm: () => Promise<void> | void;
  /** Loading externo (mutation rodando) */
  confirmLoading?: boolean;
}

const verdictConfig: Record<Verdict, { label: string; icon: typeof CheckCircle2; color: string; description: string }> = {
  confirmed_no_show: {
    label: "IA confirma: parece No-Show",
    icon: CheckCircle2,
    color: "text-emerald-600 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20",
    description: "A conversa indica que o lead não compareceu / não respondeu.",
  },
  not_no_show: {
    label: "IA discorda: NÃO parece No-Show",
    icon: XCircle,
    color: "text-red-600 border-red-500 bg-red-50 dark:bg-red-950/20",
    description: "A conversa sugere que o lead reagendou, compareceu, ou a reunião aconteceu.",
  },
  uncertain: {
    label: "IA está incerta",
    icon: HelpCircle,
    color: "text-yellow-600 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20",
    description: "Não foi possível determinar com clareza pela conversa.",
  },
  error: {
    label: "Falha na análise",
    icon: AlertTriangle,
    color: "text-muted-foreground border-border bg-muted",
    description: "Houve um erro ao processar o print.",
  },
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
  const [justification, setJustification] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings (modo da IA)
  const { data: settings } = useQuery({
    queryKey: ["no_show_ai_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("no_show_ai_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const mode = (settings?.mode as "suggest" | "block" | "audit") ?? "suggest";

  useEffect(() => {
    if (!open) {
      // reset quando fecha
      setFile(null);
      setPreviewUrl(null);
      setEvidencePath(null);
      setAiResult(null);
      setAiError(null);
      setJustification("");
      setAnalyzing(false);
      setUploading(false);
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

    // Upload imediato
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

      // Dispara análise da IA
      setAnalyzing(true);
      const { data: aiData, error: aiErr } = await supabase.functions.invoke(
        "validate-no-show-evidence",
        {
          body: {
            evidence_path: path,
            lead_phone: leadPhone ?? null,
            lead_name: leadName ?? null,
            meeting_scheduled_at: meetingScheduledAt ?? null,
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

  const handleConfirm = async () => {
    if (!evidencePath || !aiResult) {
      toast.error("Anexe um print antes de confirmar.");
      return;
    }
    const isOverride = aiResult.verdict === "not_no_show";
    if (isOverride && justification.trim().length < 10) {
      toast.error("Como a IA discordou, descreva em pelo menos 10 caracteres por que ainda é No-Show.");
      return;
    }
    if (mode === "block" && aiResult.verdict === "not_no_show") {
      toast.error("A IA bloqueou esta marcação. Reagende ou ajuste o status.");
      return;
    }

    // Persiste registro da validação (mesmo se override)
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;
      await supabase.from("no_show_validations").insert({
        deal_id: dealId,
        meeting_slot_id: meetingSlotId,
        attendee_id: attendeeId,
        lead_phone: leadPhone,
        evidence_path: evidencePath,
        ai_verdict: aiResult.verdict,
        ai_reasoning: aiResult.reasoning,
        ai_extracted_phone: aiResult.extracted_phone,
        phone_match: aiResult.phone_match,
        ai_model: "google/gemini-3-flash-preview",
        human_decision: "no_show",
        human_overrode_ai: isOverride,
        human_justification: justification || null,
        performed_by: uid,
        performed_by_role: performedByRole,
        bu_origin_id: buOriginId,
      });
    } catch (e) {
      console.error("Failed to save no_show_validation", e);
      // continua mesmo se falhar o log
    }

    await onConfirm();
  };

  const verdict = aiResult?.verdict ?? null;
  const cfg = verdict ? verdictConfig[verdict] : null;
  const VerdictIcon = cfg?.icon;
  const blocked = mode === "block" && verdict === "not_no_show";
  const requiresJustification = verdict === "not_no_show" && !blocked;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Marcar No-Show com evidência
          </DialogTitle>
          <DialogDescription>
            Anexe um print da conversa onde fica claro o motivo do No-Show. A IA vai analisar
            o conteúdo e validar o número de telefone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload */}
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
                  <span className="font-medium">Resumo da conversa:</span> {aiResult.conversation_summary}
                </div>
                <div>
                  <span className="font-medium">Análise:</span> {aiResult.reasoning}
                </div>
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
                  {aiResult.phone_match === null && (
                    <Badge variant="secondary" className="text-xs">Telefone não verificado</Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          {requiresJustification && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                A IA discordou. Justifique por que ainda é No-Show <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Ex: lead disse que viria mas sumiu na hora; print só mostra parte da conversa..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Esse override fica registrado para auditoria da liderança.
              </p>
            </div>
          )}

          {blocked && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Marcação bloqueada</AlertTitle>
              <AlertDescription>
                A IA determinou que esta conversa não caracteriza No-Show. Considere reagendar
                ou marcar como realizada.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirmLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              !aiResult ||
              uploading ||
              analyzing ||
              blocked ||
              confirmLoading ||
              (requiresJustification && justification.trim().length < 10)
            }
            className="bg-yellow-600 hover:bg-yellow-700"
          >
            {confirmLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar No-Show
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}