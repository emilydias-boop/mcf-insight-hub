import { useState, useMemo } from "react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Calculator, 
  Check, 
  Download, 
  Plus, 
  RefreshCw, 
  Search,
  Users,
  DollarSign,
  TrendingUp,
  Percent
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { 
  useFechamentosMes, 
  useFechamentoPessoas,
  useFechamentoMutations,
  useGenerateFechamento,
  useAproveFechamentoPessoa,
} from "@/hooks/useFechamentoGenerico";
import { CompetenciaSelector } from "@/components/fechamento-generico/CompetenciaSelector";
import { FechamentoStatusBadge } from "@/components/fechamento-generico/FechamentoStatusBadge";
import { FechamentoPessoaDrawer } from "@/components/fechamento-generico/FechamentoPessoaDrawer";
import { FechamentoPessoa, AREA_OPTIONS } from "@/types/fechamento-generico";

export default function RHFechamento() {
  const currentMonth = format(new Date(), "yyyy-MM");
  const [competencia, setCompetencia] = useState(currentMonth);
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedPessoa, setSelectedPessoa] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: fechamentos = [], isLoading: loadingFechamentos } = useFechamentosMes();
  const currentFechamento = useMemo(() => 
    fechamentos.find(f => f.competencia === competencia),
    [fechamentos, competencia]
  );
  
  const { data: pessoas = [], isLoading: loadingPessoas } = useFechamentoPessoas(
    currentFechamento?.id || null
  );

  const generateFechamento = useGenerateFechamento();
  const approvePessoa = useAproveFechamentoPessoa();
  const { updateFechamento } = useFechamentoMutations();

  const competenciaLabel = useMemo(() => {
    const date = parse(competencia, "yyyy-MM", new Date());
    return format(date, "MMMM 'de' yyyy", { locale: ptBR });
  }, [competencia]);

  const filteredPessoas = useMemo(() => {
    return pessoas.filter((p: any) => {
      const matchesSearch = 
        !search || 
        p.employee?.nome_completo?.toLowerCase().includes(search.toLowerCase()) ||
        p.cargo?.nome_exibicao?.toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [pessoas, search, statusFilter]);

  const stats = useMemo(() => {
    const total = pessoas.reduce((acc: number, p: any) => acc + (p.total_a_pagar || 0), 0);
    const fixo = pessoas.reduce((acc: number, p: any) => acc + (p.fixo_valor || 0), 0);
    const variavel = pessoas.reduce((acc: number, p: any) => acc + (p.variavel_final || 0), 0);
    const aprovados = pessoas.filter((p: any) => p.status === "aprovado" || p.status === "pago").length;
    
    return { total, fixo, variavel, aprovados, count: pessoas.length };
  }, [pessoas]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleGenerateFechamento = async () => {
    try {
      await generateFechamento.mutateAsync(competencia);
      setGenerateDialogOpen(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleApprovePessoa = async (pessoaId: string) => {
    try {
      await approvePessoa.mutateAsync(pessoaId);
      setDrawerOpen(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleApproveAll = async () => {
    if (!currentFechamento) return;
    
    const pendentes = pessoas.filter((p: any) => p.status === "em_revisao");
    for (const pessoa of pendentes) {
      await approvePessoa.mutateAsync(pessoa.id);
    }
    toast.success(`${pendentes.length} colaboradores aprovados`);
  };

  const handleOpenDrawer = (pessoa: any) => {
    setSelectedPessoa(pessoa);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Fechamento Mensal</h1>
          <p className="text-muted-foreground">
            Calcule e aprove os pagamentos de cada colaborador
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!currentFechamento ? (
            <Button onClick={() => setGenerateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Gerar Fechamento
            </Button>
          ) : (
            <>
              <Button 
                variant="outline"
                onClick={handleApproveAll}
                disabled={!pessoas.some((p: any) => p.status === "em_revisao")}
              >
                <Check className="mr-2 h-4 w-4" />
                Aprovar Todos
              </Button>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Competência Selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <CompetenciaSelector
          value={competencia}
          onChange={setCompetencia}
        />
        <p className="text-lg font-medium capitalize">{competenciaLabel}</p>
        {currentFechamento && (
          <FechamentoStatusBadge status={currentFechamento.status} />
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Colaboradores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Fixo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(stats.fixo)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Variável
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.variavel)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Total a Pagar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{formatCurrency(stats.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Aprovados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {stats.aprovados}/{stats.count}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou cargo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="em_revisao">Em Revisão</SelectItem>
            <SelectItem value="aprovado">Aprovado</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loadingFechamentos || loadingPessoas ? (
        <Card>
          <CardContent className="py-8">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : !currentFechamento ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calculator className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              Nenhum fechamento gerado para {competenciaLabel}
            </p>
            <Button onClick={() => setGenerateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Gerar Fechamento
            </Button>
          </CardContent>
        </Card>
      ) : filteredPessoas.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum colaborador encontrado
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead className="text-right">Fixo</TableHead>
                <TableHead className="text-right">Variável</TableHead>
                <TableHead className="text-right">Mult.</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPessoas.map((pessoa: any) => (
                <TableRow 
                  key={pessoa.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleOpenDrawer(pessoa)}
                >
                  <TableCell className="font-medium">
                    {pessoa.employee?.nome_completo || "—"}
                  </TableCell>
                  <TableCell>{pessoa.cargo?.nome_exibicao || "—"}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(pessoa.fixo_valor)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-green-600">
                    {formatCurrency(pessoa.variavel_final)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {pessoa.multiplicador_final.toFixed(2)}x
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {formatCurrency(pessoa.total_a_pagar)}
                  </TableCell>
                  <TableCell className="text-center">
                    <FechamentoStatusBadge status={pessoa.status} type="pessoa" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Generate Dialog */}
      <AlertDialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar Fechamento</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá criar um novo fechamento para {competenciaLabel} e calcular os valores de todos os colaboradores ativos com cargo configurado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleGenerateFechamento}
              disabled={generateFechamento.isPending}
            >
              {generateFechamento.isPending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="mr-2 h-4 w-4" />
              )}
              Gerar Fechamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pessoa Drawer */}
      <FechamentoPessoaDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        pessoa={selectedPessoa}
        onApprove={handleApprovePessoa}
      />
    </div>
  );
}
