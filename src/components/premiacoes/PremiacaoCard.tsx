import { Link } from 'react-router-dom';
import { Trophy, Calendar, Users, ArrowRight, Clock } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Premiacao, METRICAS_OPTIONS } from '@/types/premiacoes';
import { BU_OPTIONS } from '@/hooks/useMyBU';
import { cn } from '@/lib/utils';

interface PremiacaoCardProps {
  premiacao: Premiacao;
}

export default function PremiacaoCard({ premiacao }: PremiacaoCardProps) {

  const dataFim = parseISO(premiacao.data_fim);
  const dataInicio = parseISO(premiacao.data_inicio);
  const diasRestantes = differenceInDays(dataFim, new Date());
  const buLabel = BU_OPTIONS.find(b => b.value === premiacao.bu)?.label || premiacao.bu;
  const metricaLabel = METRICAS_OPTIONS.find(m => m.value === premiacao.metrica_ranking)?.label || premiacao.metrica_ranking;

  const getStatusBadge = () => {
    switch (premiacao.status) {
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
  };

  return (
    <Card className="group hover:shadow-lg transition-shadow duration-200 flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-lg line-clamp-2">{premiacao.nome}</CardTitle>
          {getStatusBadge()}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {premiacao.descricao || 'Sem descrição'}
        </p>
      </CardHeader>
      
      <CardContent className="flex-1 space-y-4">
        {/* Prêmio */}
        <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg border border-yellow-500/20">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{premiacao.premio_descricao}</p>
            {premiacao.premio_valor && (
              <p className="text-xs text-muted-foreground">
                R$ {premiacao.premio_valor.toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {format(dataInicio, 'dd/MM', { locale: ptBR })} - {format(dataFim, 'dd/MM', { locale: ptBR })}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>Top {premiacao.qtd_ganhadores}</span>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-xs">{buLabel}</Badge>
          <Badge variant="outline" className="text-xs">{metricaLabel}</Badge>
          <Badge variant="outline" className="text-xs capitalize">{premiacao.tipo_competicao}</Badge>
        </div>

        {/* Countdown */}
        {premiacao.status === 'ativa' && diasRestantes >= 0 && (
          <div className={cn(
            "flex items-center gap-2 text-sm font-medium",
            diasRestantes <= 3 ? "text-red-500" : diasRestantes <= 7 ? "text-yellow-500" : "text-green-500"
          )}>
            <Clock className="h-4 w-4" />
            {diasRestantes === 0 ? 'Último dia!' : `${diasRestantes} dias restantes`}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        <Button variant="ghost" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors" asChild>
          <Link to={`/premiacoes/${premiacao.id}`}>
            Ver Ranking
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
