import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, ShieldAlert, CheckCircle2, XCircle, Phone, User, Calendar, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useNoShowPendingReviews, useReviewNoShowContest, getEvidenceSignedUrl, type PendingReview } from "@/hooks/useNoShowReviews";

function ReviewCard({ item }: { item: PendingReview }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const review = useReviewNoShowContest();

  useEffect(() => {
    let alive = true;
    getEvidenceSignedUrl(item.evidence_path).then((u) => alive && setImgUrl(u));
    return () => {
      alive = false;
    };
  }, [item.evidence_path]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-orange-600" />
              Contestação de No-Show {item.meeting_type ?? "R1"}
            </CardTitle>
            <CardDescription className="text-xs">
              Enviada em {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </CardDescription>
          </div>
          <Badge variant="destructive" className="text-xs">IA: not_no_show</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="text-xs space-y-1">
              <div className="flex items-center gap-2"><Phone className="h-3 w-3" /> Tel. lead: {item.lead_phone || "—"}</div>
              <div className="flex items-center gap-2"><User className="h-3 w-3" /> Tel. extraído: {item.ai_extracted_phone || "—"}</div>
              <div className="flex items-center gap-2">
                {item.phone_match ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <XCircle className="h-3 w-3 text-red-500" />}
                {item.phone_match ? "Telefones batem" : "Telefones divergem"}
              </div>
            </div>
            <div className="rounded-md border p-3 bg-muted/40 space-y-2">
              <div className="text-xs font-semibold">Análise da IA</div>
              <p className="text-xs text-muted-foreground">{item.ai_reasoning || "—"}</p>
            </div>
            <div className="rounded-md border p-3 bg-orange-50 dark:bg-orange-950/20">
              <div className="text-xs font-semibold text-orange-700 dark:text-orange-300 mb-1">Justificativa do SDR</div>
              <p className="text-xs whitespace-pre-wrap">{item.sdr_justification || "(sem justificativa)"}</p>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold mb-2 flex items-center gap-2"><ImageIcon className="h-3 w-3" /> Print enviado</div>
            {imgUrl ? (
              <a href={imgUrl} target="_blank" rel="noreferrer">
                <img src={imgUrl} alt="Evidência" className="max-h-72 w-full object-contain rounded-md border bg-muted" />
              </a>
            ) : (
              <div className="h-72 flex items-center justify-center text-xs text-muted-foreground border rounded-md">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <label className="text-xs font-medium">Notas do gestor (opcional)</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Comentário sobre a decisão..."
          />
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            className="text-red-600 border-red-300 hover:bg-red-50"
            disabled={review.isPending}
            onClick={() => review.mutate({ validationId: item.id, decision: "rejected", notes })}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Rejeitar
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={review.isPending}
            onClick={() => review.mutate({ validationId: item.id, decision: "approved", notes })}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Aprovar No-Show
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RevisaoNoShows() {
  const { data: items, isLoading } = useNoShowPendingReviews();

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-orange-600" />
          Revisão de No-Shows Contestados
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Contestações enviadas pelos SDRs/Closers quando a IA discordou da marcação. Revise o print
          + análise da IA + justificativa e aprove ou rejeite.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      )}

      {!isLoading && (!items || items.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-600" />
            Nenhuma contestação pendente. Tudo em dia!
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {items?.map((it) => <ReviewCard key={it.id} item={it} />)}
      </div>
    </div>
  );
}