import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMyNoShowEvidences, getEvidenceSignedUrl, type PendingReview } from "@/hooks/useNoShowReviews";

interface Props {
  dealId: string | null | undefined;
}

function statusBadge(item: PendingReview) {
  const mr = item.manager_review_status;
  if (mr === "pending") {
    return (
      <Badge className="bg-orange-500 hover:bg-orange-500 text-[10px] gap-1">
        <Clock className="h-3 w-3" /> Aguardando gestor
      </Badge>
    );
  }
  if (mr === "approved") {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px] gap-1">
        <CheckCircle2 className="h-3 w-3" /> Aprovado pelo gestor
      </Badge>
    );
  }
  if (mr === "rejected") {
    return (
      <Badge variant="destructive" className="text-[10px] gap-1">
        <XCircle className="h-3 w-3" /> Rejeitado pelo gestor
      </Badge>
    );
  }
  if (item.ai_verdict === "confirmed") {
    return (
      <Badge className="bg-emerald-600/80 hover:bg-emerald-600/80 text-[10px] gap-1">
        <CheckCircle2 className="h-3 w-3" /> Auto-aprovado
      </Badge>
    );
  }
  if (item.ai_verdict === "inconclusive") {
    return (
      <Badge className="bg-yellow-600 hover:bg-yellow-600 text-[10px] gap-1">
        <HelpCircle className="h-3 w-3" /> Aprovado c/ justificativa
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-[10px]">{item.final_status ?? "—"}</Badge>;
}

function EvidenceRow({ item }: { item: PendingReview }) {
  const [open, setOpen] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || imgUrl) return;
    let alive = true;
    getEvidenceSignedUrl(item.evidence_path).then((u) => alive && setImgUrl(u));
    return () => {
      alive = false;
    };
  }, [open, imgUrl, item.evidence_path]);

  return (
    <div className="rounded-md border bg-muted/30 p-2 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-3.5 w-3.5 text-orange-600" />
          <span className="font-medium">
            No-Show {item.meeting_type ?? "R1"}
          </span>
          <span className="text-muted-foreground">
            {format(new Date(item.created_at), "dd/MM HH:mm", { locale: ptBR })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {statusBadge(item)}
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </div>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {imgUrl ? (
            <a href={imgUrl} target="_blank" rel="noreferrer">
              <img
                src={imgUrl}
                alt="Evidência"
                className="max-h-48 w-full object-contain rounded border bg-muted"
              />
            </a>
          ) : (
            <div className="h-24 flex items-center justify-center border rounded">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {item.ai_reasoning && (
            <div>
              <span className="font-medium">IA:</span>{" "}
              <span className="text-muted-foreground">{item.ai_reasoning}</span>
            </div>
          )}
          {item.sdr_justification && (
            <div>
              <span className="font-medium">Sua justificativa:</span>{" "}
              <span className="text-muted-foreground whitespace-pre-wrap">{item.sdr_justification}</span>
            </div>
          )}
          {item.manager_review_notes && (
            <div>
              <span className="font-medium">Notas do gestor:</span>{" "}
              <span className="text-muted-foreground whitespace-pre-wrap">{item.manager_review_notes}</span>
            </div>
          )}
          {item.manager_review_status === "rejected" && (
            <div className="rounded border border-orange-300 bg-orange-50 dark:bg-orange-950/20 p-2 text-orange-800 dark:text-orange-200">
              Reunião liberada — você pode marcar No-Show de novo enviando outra evidência.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function LeadNoShowEvidenceHistory({ dealId }: Props) {
  const { data, isLoading } = useMyNoShowEvidences({ dealId });

  if (!dealId) return null;
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Carregando evidências...
      </div>
    );
  }
  if (!data || data.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold flex items-center gap-2">
          <ShieldAlert className="h-3.5 w-3.5 text-orange-600" />
          Suas evidências de No-Show ({data.length})
        </div>
      </div>
      <div className="space-y-1.5">
        {data.map((it) => (
          <EvidenceRow key={it.id} item={it} />
        ))}
      </div>
    </div>
  );
}