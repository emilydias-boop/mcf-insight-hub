import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Calendar, Users, Clock, Edit, Play, StopCircle, Trash2 } from 'lucide-react';
import { format, differenceInDays, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import { usePremiacao, useAtivarPremiacao, useEncerrarPremiacao, useDeletePremiacao } from '@/hooks/usePremiacoes';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { RankingLeaderboard } from '@/components/premiacoes/RankingLeaderboard';
import { METRICAS_OPTIONS, CARGOS_ELEGIVEIS_OPTIONS } from '@/types/premiacoes';
import { BU_OPTIONS } from '@/hooks/useMyBU';
import { cn } from '@/lib/utils';

export default function PremiacaoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: premiacao, isLoading } = usePremiacao(id);
  const { isAdmin } = useMyPermissions();
  const ativarMutation = useAtivarPremiacao();
  const encerrarMutation = useEncerrarPremiacao();
  const deleteMutation = useDeletePremiacao();

  const canEdit = isAdmin;

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!premiacao) {
    return (
      <div className="container mx-auto py-6">
        <Card className="py-12">
          <CardContent className="text-center">
            <Trophy className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Premiação não encontrada</p>
            <Button variant="link" asChild className="mt-4">
              <Link to="/premiacoes">Voltar para lista</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const dataFim = parseISO(premiacao.data_fim);
  const dataInicio = parseISO(premiacao.data_inicio);
  const diasRestantes = differenceInDays(dataFim, new Date());
  const isActive = premiacao.status === 'ativa' && isWithinInterval(new Date(), { start: dataInicio, end: dataFim });
  const buLabel = BU_OPTIONS.find(b => b.value === premiacao.bu)?.label || premiacao.bu;
  const metricaInfo = METRICAS_OPTIONS.find(m => m.value === premiacao.metrica_ranking);

  const handleAtivar = () => {
    ativarMutation.mutate(premiacao.id);
  };

  const handleEncerrar = () => {
    encerrarMutation.mutate(premiacao.id);
  };

  const handleDelete = () => {
    deleteMutation.mutate(premiacao.id, {
      onSuccess: () => navigate('/premiacoes'),
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/premiacoes">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{premiacao.nome}</h1>
            <StatusBadge status={premiacao.status} />
          </div>
          <p className="text-muted-foreground">{premiacao.descricao}</p>
        </div>
        
        {canEdit && (
          <div className="flex gap-2">
            {premiacao.status === 'rascunho' && (
              <Button onClick={handleAtivar} disabled={ativarMutation.isPending}>
                <Play className="h-4 w-4 mr-2" />
                Ativar
              </Button>
            )}
            {premiacao.status === 'ativa' && (
              <Button variant="destructive" onClick={handleEncerrar} disabled={encerrarMutation.isPending}>
                <StopCircle className="h-4 w-4 mr-2" />
                Encerrar
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir premiação?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. A premiação será permanentemente excluída.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Prêmio */}
        <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              Prêmio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{premiacao.premio_descricao}</p>
            {premiacao.premio_valor && (
              <p className="text-sm text-muted-foreground">
                R$ {premiacao.premio_valor.toLocaleString('pt-BR')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Período */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">
              {format(dataInicio, "dd 'de' MMM", { locale: ptBR })} - {format(dataFim, "dd 'de' MMM", { locale: ptBR })}
            </p>
            {isActive && (
              <p className={cn(
                "text-sm font-medium",
                diasRestantes <= 3 ? "text-red-500" : diasRestantes <= 7 ? "text-yellow-500" : "text-green-500"
              )}>
                {diasRestantes === 0 ? 'Último dia!' : `${diasRestantes} dias restantes`}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Ganhadores */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Ganhadores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">Top {premiacao.qtd_ganhadores}</p>
            <p className="text-sm text-muted-foreground capitalize">{premiacao.tipo_competicao}</p>
          </CardContent>
        </Card>

        {/* Métrica */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Métrica
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{metricaInfo?.label}</p>
            <p className="text-sm text-muted-foreground">{metricaInfo?.descricao}</p>
          </CardContent>
        </Card>
      </div>

      {/* Regras e Participantes */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Participantes Elegíveis</CardTitle>
            <CardDescription>BU e cargos que podem participar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Business Unit</p>
              <Badge>{buLabel}</Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Cargos</p>
              <div className="flex flex-wrap gap-2">
                {premiacao.cargos_elegiveis.map(cargo => (
                  <Badge key={cargo} variant="outline">
                    {CARGOS_ELEGIVEIS_OPTIONS.find(c => c.value === cargo)?.label || cargo}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Regras da Competição</CardTitle>
            <CardDescription>Como o ranking é calculado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              <span className="font-medium">Tipo:</span> {premiacao.tipo_competicao === 'individual' ? 'Competição individual' : premiacao.tipo_competicao === 'equipe' ? 'Competição por equipe' : 'Individual e por equipe'}
            </p>
            <p className="text-sm">
              <span className="font-medium">Métrica:</span> {metricaInfo?.label} - {metricaInfo?.descricao}
            </p>
            <p className="text-sm">
              <span className="font-medium">Premiados:</span> Top {premiacao.qtd_ganhadores} {premiacao.qtd_ganhadores === 1 ? 'colaborador' : 'colaboradores'}
            </p>
            {premiacao.metrica_config?.inverso && (
              <p className="text-sm text-yellow-600">
                ⚠️ Métrica inversa: menor valor = melhor posição
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ranking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Ranking Atual
          </CardTitle>
          <CardDescription>
            Posições atualizadas em tempo real baseado em {metricaInfo?.label}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RankingLeaderboard 
            premiacao={premiacao} 
            qtdGanhadores={premiacao.qtd_ganhadores}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'ativa':
      return <Badge className="bg-green-500 hover:bg-green-600">Ativa</Badge>;
    case 'rascunho':
      return <Badge variant="secondary">Rascunho</Badge>;
    case 'encerrada':
      return <Badge variant="outline">Encerrada</Badge>;
    case 'cancelada':
      return <Badge variant="destructive">Cancelada</Badge>;
    default:
      return null;
  }
}
