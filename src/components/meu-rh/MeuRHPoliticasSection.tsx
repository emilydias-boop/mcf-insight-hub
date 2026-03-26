import { FileText, Download, ExternalLink, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivePolicies, POLICY_CATEGORY_LABELS, type RhPolicy } from "@/hooks/useRhPolicies";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function PolicyCard({ policy }: { policy: RhPolicy }) {
  const handleDownload = async () => {
    if (policy.storage_path) {
      const { data, error } = await supabase.storage
        .from("rh-policies")
        .createSignedUrl(policy.storage_path, 3600);
      if (error) {
        toast.error("Erro ao gerar link de download");
        return;
      }
      window.open(data.signedUrl, "_blank");
    } else if (policy.arquivo_url) {
      window.open(policy.arquivo_url, "_blank");
    }
  };

  const hasFile = policy.storage_path || policy.arquivo_url;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span className="text-xl mt-0.5">
          {POLICY_CATEGORY_LABELS[policy.categoria]?.icon || '📄'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{policy.titulo}</span>
            {policy.versao && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                v{policy.versao}
              </Badge>
            )}
            {policy.obrigatoria && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                Obrigatória
              </Badge>
            )}
          </div>
          {policy.descricao && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {policy.descricao}
            </p>
          )}
        </div>
      </div>
      {hasFile && (
        <Button size="sm" variant="ghost" onClick={handleDownload} className="ml-2 shrink-0">
          <ExternalLink className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Abrir</span>
        </Button>
      )}
    </div>
  );
}

export function MeuRHPoliticasSection() {
  const { data: policies, isLoading } = useActivePolicies();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
        </CardContent>
      </Card>
    );
  }

  if (!policies || policies.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-3 rounded-full bg-muted mb-4">
            <Shield className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Nenhuma política disponível</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            As políticas e diretrizes da empresa serão publicadas aqui em breve.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group by category
  const grouped = policies.reduce<Record<string, RhPolicy[]>>((acc, p) => {
    const cat = p.categoria || 'outro';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  const categoryOrder: RhPolicy['categoria'][] = ['politica', 'codigo_conduta', 'manual', 'procedimento', 'outro'];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5" />
          Políticas e Diretrizes MCF
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {categoryOrder.map(cat => {
          const items = grouped[cat];
          if (!items || items.length === 0) return null;
          const label = POLICY_CATEGORY_LABELS[cat];
          return (
            <div key={cat}>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                {label.icon} {label.label} ({items.length})
              </h4>
              <div className="space-y-2">
                {items.map(p => <PolicyCard key={p.id} policy={p} />)}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
