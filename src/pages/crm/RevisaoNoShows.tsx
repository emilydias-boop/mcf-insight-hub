import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, ShieldAlert, CheckCircle2, XCircle, Phone, User, Calendar, Image as ImageIcon, Briefcase, Tag, Users, AlertCircle, Clock, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNoShowPendingReviews, useReviewNoShowContest, useDeleteNoShowValidation, getEvidenceSignedUrl, type PendingReview } from "@/hooks/useNoShowReviews";
import { useNoShowBlockedAttempts } from "@/hooks/useNoShowBlockedAttempts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type StatusFilter = "all" | "pending" | "approved" | "rejected" | "auto" | "blocked";

function statusBadge(item: PendingReview) {
  const mr = item.manager_review_status;
  if (mr === "pending") {
    return <Badge className="bg-orange-500 hover:bg-orange-500 text-xs">Pendente revisão</Badge>;
  }
  if (mr === "approved") {
    return <Badge className="bg-emerald-600 hover:bg-emerald-600 text-xs">Aprovado pelo gestor</Badge>;
  }
  if (mr === "rejected") {
    return <Badge variant="destructive" className="text-xs">Rejeitado pelo gestor</Badge>;
  }
  // sem revisão de gestor → fluxo automático
  if (item.ai_verdict === "confirmed") {
    return <Badge className="bg-emerald-600/80 hover:bg-emerald-600/80 text-xs">Auto-aprovado (IA)</Badge>;
  }
  if (item.ai_verdict === "inconclusive") {
    return <Badge className="bg-yellow-600 hover:bg-yellow-600 text-xs">Inconclusivo + justificativa</Badge>;
  }
  if (item.ai_verdict === "not_no_show") {
    return <Badge variant="destructive" className="text-xs">Bloqueado pela IA</Badge>;
  }
  return <Badge variant="outline" className="text-xs">{item.final_status ?? "—"}</Badge>;
}

function ReviewCard({ item }: { item: PendingReview }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const review = useReviewNoShowContest();
  const del = useDeleteNoShowValidation();
  const isPending = item.manager_review_status === "pending";

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
              No-Show {item.meeting_type ?? "R1"} — {item.lead?.name || item.deal?.name || item.lead_phone || "lead sem identificação"}
            </CardTitle>
            <CardDescription className="text-xs">
              Registrado em {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              {item.performed_by_profile?.full_name && (
                <> · por <strong>{item.performed_by_profile.full_name}</strong>{item.performed_by_role ? ` (${item.performed_by_role})` : ""}</>
              )}
              {item.manager_review_at && (
                <> · Revisado em {format(new Date(item.manager_review_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}{item.manager_review_by_profile?.full_name ? ` por ${item.manager_review_by_profile.full_name}` : ""}</>
              )}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            {statusBadge(item)}
            <Badge variant="outline" className="text-[10px]">IA: {item.ai_verdict ?? "—"}</Badge>
            {typeof item.prior_no_shows_for_deal === "number" && item.prior_no_shows_for_deal > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {item.prior_no_shows_for_deal} no-show(s) deste lead
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bloco de contexto: lead, reunião, atribuição */}
        <div className="rounded-md border bg-muted/30 p-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="space-y-1">
            <div className="font-semibold flex items-center gap-1"><Briefcase className="h-3 w-3" /> Lead</div>
            <div>{item.lead?.name || item.deal?.name || "—"}</div>
            {item.deal?.product_name && <div className="text-muted-foreground">Produto: {item.deal.product_name}</div>}
            {item.deal?.origin_name && <div className="text-muted-foreground">Origem: {item.deal.origin_name}</div>}
            <div className="text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {item.lead?.phone || item.lead_phone || "—"}</div>
          </div>
          <div className="space-y-1">
            <div className="font-semibold flex items-center gap-1"><Calendar className="h-3 w-3" /> Reunião {item.meeting?.meeting_type || item.meeting_type || "R1"}</div>
            {item.meeting?.scheduled_at ? (
              <>
                <div>{format(new Date(item.meeting.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
                {item.meeting.duration_minutes && (
                  <div className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {item.meeting.duration_minutes} min</div>
                )}
              </>
            ) : (
              <div className="text-muted-foreground">Reunião não localizada</div>
            )}
            {item.meeting?.sdr_booked_name && (
              <div className="text-muted-foreground">SDR que agendou: {item.meeting.sdr_booked_name}</div>
            )}
            {item.meeting?.closer_name && (
              <div className="text-muted-foreground">Closer da reunião: {item.meeting.closer_name}</div>
            )}
          </div>
          <div className="space-y-1">
            <div className="font-semibold flex items-center gap-1"><Users className="h-3 w-3" /> Atribuição</div>
            {item.performed_by_profile?.full_name && (
              <div>
                Solicitado por <strong>{item.performed_by_profile.full_name}</strong>
                {item.performed_by_role ? ` (${item.performed_by_role})` : ""}
              </div>
            )}
            {item.performed_by_profile?.email && (
              <div className="text-muted-foreground text-[11px]">{item.performed_by_profile.email}</div>
            )}
            {item.deal?.original_sdr_email && (
              <div className="text-muted-foreground">SDR original: {item.deal.original_sdr_email}</div>
            )}
            {item.deal?.r1_closer_email && (
              <div className="text-muted-foreground">R1 closer: {item.deal.r1_closer_email}</div>
            )}
            {item.deal?.r2_closer_email && (
              <div className="text-muted-foreground">R2 closer: {item.deal.r2_closer_email}</div>
            )}
            {!item.performed_by_profile?.full_name &&
             !item.deal?.original_sdr_email &&
             !item.deal?.r1_closer_email &&
             !item.deal?.r2_closer_email && (
              <div className="text-muted-foreground">—</div>
            )}
          </div>
        </div>

        {/* Alerta quando IA bloqueou (contestação) */}
        {item.ai_verdict === "not_no_show" && (
          <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/20 p-3 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-red-700 dark:text-red-300">Por que a IA NÃO autorizou este No-Show</div>
              <div className="text-red-700/80 dark:text-red-300/90">{item.ai_reasoning || "Sem detalhes."}</div>
            </div>
          </div>
        )}

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
              <div className="text-xs font-semibold">Análise da IA {item.ai_verdict ? `(${item.ai_verdict})` : ""}</div>
              <p className="text-xs text-muted-foreground">{item.ai_reasoning || "—"}</p>
            </div>
            {item.sdr_justification && (
              <div className="rounded-md border p-3 bg-orange-50 dark:bg-orange-950/20">
                <div className="text-xs font-semibold text-orange-700 dark:text-orange-300 mb-1">Justificativa do SDR/Closer</div>
                <p className="text-xs whitespace-pre-wrap">{item.sdr_justification}</p>
              </div>
            )}
            {item.manager_review_notes && (
              <div className="rounded-md border p-3 bg-muted/40">
                <div className="text-xs font-semibold mb-1">Notas do gestor</div>
                <p className="text-xs whitespace-pre-wrap">{item.manager_review_notes}</p>
              </div>
            )}
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
        <div className="flex items-center justify-between gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                disabled={del.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir evidência
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir esta evidência de No-Show?</AlertDialogTitle>
                <AlertDialogDescription>
                  Use apenas para registros duplicados ou enviados por engano.
                  A evidência será removida permanentemente do histórico. Esta
                  ação NÃO altera o status atual do lead na agenda — se o
                  no-show já foi desfeito manualmente, basta excluir aqui para
                  limpar o registro.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => del.mutate(item.id)}
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {isPending && (
          <>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function RevisaoNoShows() {
  const { data: items, isLoading } = useNoShowPendingReviews();
  const { data: blocked } = useNoShowBlockedAttempts();
  const [filter, setFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    if (!items) return [];
    switch (filter) {
      case "pending":
        return items.filter((i) => i.manager_review_status === "pending");
      case "approved":
        return items.filter((i) => i.manager_review_status === "approved");
      case "rejected":
        return items.filter((i) => i.manager_review_status === "rejected");
      case "auto":
        return items.filter((i) => !i.manager_review_status);
      default:
        return items;
    }
  }, [items, filter]);

  const counts = useMemo(() => {
    const all = items ?? [];
    return {
      all: all.length,
      pending: all.filter((i) => i.manager_review_status === "pending").length,
      approved: all.filter((i) => i.manager_review_status === "approved").length,
      rejected: all.filter((i) => i.manager_review_status === "rejected").length,
      auto: all.filter((i) => !i.manager_review_status).length,
    };
  }, [items]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-orange-600" />
          Histórico de No-Shows
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Todos os No-Shows registrados com evidência: aprovados pela IA, com justificativa,
          contestados ou já revisados pelo gestor. Use o filtro para focar em pendentes.
        </p>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
        <TabsList>
          <TabsTrigger value="all">Todos ({counts.all})</TabsTrigger>
          <TabsTrigger value="pending">Pendentes ({counts.pending})</TabsTrigger>
          <TabsTrigger value="auto">Auto-aprovados ({counts.auto})</TabsTrigger>
          <TabsTrigger value="approved">Aprovados ({counts.approved})</TabsTrigger>
          <TabsTrigger value="rejected">Rejeitados ({counts.rejected})</TabsTrigger>
          <TabsTrigger value="blocked">Tentativas bloqueadas ({blocked?.length ?? 0})</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      )}

      {filter !== "blocked" && !isLoading && filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-600" />
            Nenhum registro neste filtro.
          </CardContent>
        </Card>
      )}

      {filter === "blocked" ? (
        <div className="space-y-3">
          {(blocked ?? []).length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-600" />
                Nenhuma tentativa bloqueada registrada.
              </CardContent>
            </Card>
          )}
          {(blocked ?? []).map((b) => (
            <Card key={b.id} className="border-red-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      {b.attempt_reason === "duplicate_hash"
                        ? "Print já usado em outro lead"
                        : "Reenvio bloqueado (já existe solicitação ativa)"}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {format(new Date(b.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      {b.attempted_by_profile?.full_name && (
                        <> · por <strong>{b.attempted_by_profile.full_name}</strong></>
                      )}
                      {b.lead_name && <> · Lead: {b.lead_name}</>}
                      {b.lead_phone && <> · {b.lead_phone}</>}
                      {b.meeting_type && <> · {b.meeting_type}</>}
                    </CardDescription>
                  </div>
                  <Badge variant="destructive" className="text-xs">Bloqueado</Badge>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((it) => <ReviewCard key={it.id} item={it} />)}
        </div>
      )}
    </div>
  );
}