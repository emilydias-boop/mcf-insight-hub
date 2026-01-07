import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, ChevronDown, ChevronRight, Clock, User, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useAuditoriaFechamento } from "@/hooks/useFechamentoGenerico";
import { CompetenciaSelector } from "@/components/fechamento-generico/CompetenciaSelector";

const ENTIDADE_OPTIONS = [
  { value: "all", label: "Todas as Entidades" },
  { value: "fechamento_mes", label: "Fechamento do Mês" },
  { value: "fechamento_pessoa", label: "Fechamento por Pessoa" },
  { value: "metas_mes", label: "Metas" },
  { value: "cargos_catalogo", label: "Cargos" },
  { value: "regua_multiplicador", label: "Réguas" },
];

const ACAO_COLORS: Record<string, string> = {
  criar: "bg-green-500",
  atualizar: "bg-blue-500",
  aprovar: "bg-purple-500",
  rejeitar: "bg-red-500",
  calcular: "bg-yellow-500",
  default: "bg-muted",
};

function JsonDiff({ label, data }: { label: string; data: Record<string, unknown> | null }) {
  if (!data) return null;
  
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function AuditCard({ audit }: { audit: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const acaoColor = ACAO_COLORS[audit.acao.toLowerCase()] || ACAO_COLORS.default;

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="p-0 h-auto hover:bg-transparent text-left">
                <div className="flex items-center gap-2">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`${acaoColor} text-white`}>
                        {audit.acao}
                      </Badge>
                      <Badge variant="outline">{audit.entidade}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {audit.motivo || `Alteração em ${audit.entidade}`}
                    </p>
                  </div>
                </div>
              </Button>
            </CollapsibleTrigger>
            <div className="text-right text-sm text-muted-foreground shrink-0">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(parseISO(audit.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </div>
              {audit.usuario && (
                <div className="flex items-center gap-1 justify-end mt-1">
                  <User className="h-3 w-3" />
                  {audit.usuario.full_name || audit.usuario.email}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <JsonDiff label="Antes" data={audit.antes_json} />
              <JsonDiff label="Depois" data={audit.depois_json} />
            </div>
            <div className="text-xs text-muted-foreground border-t pt-2">
              <span className="font-mono">ID: {audit.entidade_id}</span>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default function AuditoriaFechamentos() {
  const currentMonth = format(new Date(), "yyyy-MM");
  const [competencia, setCompetencia] = useState<string>(currentMonth);
  const [entidadeFilter, setEntidadeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: auditorias = [], isLoading } = useAuditoriaFechamento({
    entidade: entidadeFilter === "all" ? undefined : entidadeFilter,
    limit: 200,
  });

  const filteredAuditorias = useMemo(() => {
    return auditorias.filter((audit: any) => {
      const matchesSearch = 
        !search ||
        audit.acao.toLowerCase().includes(search.toLowerCase()) ||
        audit.entidade.toLowerCase().includes(search.toLowerCase()) ||
        audit.motivo?.toLowerCase().includes(search.toLowerCase()) ||
        audit.entidade_id.toLowerCase().includes(search.toLowerCase());
      
      return matchesSearch;
    });
  }, [auditorias, search]);

  const stats = useMemo(() => ({
    total: filteredAuditorias.length,
    criar: filteredAuditorias.filter((a: any) => a.acao.toLowerCase() === "criar").length,
    atualizar: filteredAuditorias.filter((a: any) => a.acao.toLowerCase() === "atualizar").length,
    aprovar: filteredAuditorias.filter((a: any) => a.acao.toLowerCase() === "aprovar").length,
  }), [filteredAuditorias]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Auditoria de Fechamentos</h1>
        <p className="text-muted-foreground">
          Histórico de alterações, aprovações e ajustes
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Registros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Criações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{stats.criar}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Atualizações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{stats.atualizar}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aprovações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600">{stats.aprovar}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ação, entidade, motivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={entidadeFilter} onValueChange={setEntidadeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Entidade" />
          </SelectTrigger>
          <SelectContent>
            {ENTIDADE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Audit List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : filteredAuditorias.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum registro de auditoria encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-400px)]">
          <div className="space-y-3 pr-4">
            {filteredAuditorias.map((audit: any) => (
              <AuditCard key={audit.id} audit={audit} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
