import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  Image as ImageIcon,
  Phone,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMyNoShowEvidences, getEvidenceSignedUrl, type PendingReview } from "@/hooks/useNoShowReviews";

type Filter = "all" | "pending" | "approved" | "rejected" | "auto";

function statusBadge(item: PendingReview) {
  const mr = item.manager_review_status;
  if (mr === "pending") {
    return (
      <Badge className="bg-orange-500 hover:bg-orange-500 text-xs gap-1">
        <Clock className="h-3 w-3" />
        Aguardando gestor
      </Badge>
    );
  }
  if (mr === "approved") {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-xs gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Aprovado pelo gestor
      </Badge>
    );
  }
  if (mr === "rejected") {
    return (
      <Badge variant="destructive" className="text-xs gap-1">
        <XCircle className="h-3 w-3" />
        Rejeitado pelo gestor
      </Badge>
    );
  }
  if (item.ai_verdict === "confirmed") {
    return (
      <Badge className="bg-emerald-600/80 hover:bg-emerald-600/80 text-xs gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Aprovado automaticamente
      </Badge>
    );
  }
  if (item.ai_verdict === "inconclusive") {
    return (
      <Badge className="bg-yellow-600 hover:bg-yellow-600 text-xs gap-1">
        <HelpCircle className="h-3 w-3" />
        Aprovado com justificativa
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-xs">{item.final_status ?? "—"}</Badge>;
}

function EvidenceCard({ item }: { item: PendingReview }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getEvidenceSignedUrl(item.evidence_path).then((u) => alive && setImgUrl(u));
    return () => {
      alive = false;
    };
  }, [item.evidence_path]);

  const rejected = item.manager_review_status === "rejected";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-orange-600" />
              No-Show {item.meeting_type ?? "R1"} — {item.lead_phone || "lead"}
            </CardTitle>
            <CardDescription className="text-xs">
              Enviado em {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              {item.manager_review_at && (
                <> · Revisado em {format(new Date(item.manager_review_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</>
              )}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            {statusBadge(item)}
            <Badge variant="outline" className="text-[10px]">IA: {item.ai_verdict ?? "—"}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {rejected && (
          <div className="rounded-md border border-orange-300 bg-orange-50 dark:bg-orange-950/20 p-3 text-xs text-orange-800 dark:text-orange-200">
            <strong>Reunião liberada:</strong> ela voltou para "Agendada" e você pode marcar No-Show
            de novo enviando uma evidência diferente.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="text-xs space-y-1">
              <div className="flex items-center gap-2">
                <Phone className="h-3 w-3" /> Tel. lead: {item.lead_phone || "—"}
              </div>
              <div className="flex items-center gap-2">
                {item.phone_match ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                ) : (
                  <XCircle className="h-3 w-3 text-red-500" />
                )}
                {item.phone_match ? "Telefones batem" : "Telefones divergem"}
              </div>
            </div>
            <div className="rounded-md border p-3 bg-muted/40 space-y-1">
              <div className="text-xs font-semibold">Análise da IA</div>
              <p className="text-xs text-muted-foreground">{item.ai_reasoning || "—"}</p>
            </div>
            {item.sdr_justification && (
              <div className="rounded-md border p-3 bg-muted/40">
                <div className="text-xs font-semibold mb-1">Sua justificativa</div>
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
            <div className="text-xs font-semibold mb-2 flex items-center gap-2">
              <ImageIcon className="h-3 w-3" /> Print enviado
            </div>
            {imgUrl ? (
              <a href={imgUrl} target="_blank" rel="noreferrer">
                <img
                  src={imgUrl}
                  alt="Evidência"
                  className="max-h-72 w-full object-contain rounded-md border bg-muted"
                />
              </a>
            ) : (
              <div className="h-72 flex items-center justify-center text-xs text-muted-foreground border rounded-md">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MeusNoShows() {
  const { data: items, isLoading } = useMyNoShowEvidences();
  const [filter, setFilter] = useState<Filter>("all");

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
          Meus No-Shows
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Histórico das evidências de No-Show que você enviou. Aprovados automaticamente,
          aguardando gestor, aprovados ou rejeitados.
        </p>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList>
          <TabsTrigger value="all">Todos ({counts.all})</TabsTrigger>
          <TabsTrigger value="pending">Aguardando gestor ({counts.pending})</TabsTrigger>
          <TabsTrigger value="auto">Auto-aprovados ({counts.auto})</TabsTrigger>
          <TabsTrigger value="approved">Aprovados ({counts.approved})</TabsTrigger>
          <TabsTrigger value="rejected">Rejeitados ({counts.rejected})</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma evidência neste filtro.
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {filtered.map((it) => (
          <EvidenceCard key={it.id} item={it} />
        ))}
      </div>
    </div>
  );
}