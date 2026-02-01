import { useMemo } from 'react';
import { Trophy, Medal, Award, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Premiacao, ParticipanteRanking, METRICAS_OPTIONS } from '@/types/premiacoes';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface RankingLeaderboardProps {
  premiacao: Premiacao;
  qtdGanhadores: number;
}

export function RankingLeaderboard({ premiacao, qtdGanhadores }: RankingLeaderboardProps) {
  const { user } = useAuth();

  // Buscar colaboradores elegíveis
  const { data: employees, isLoading: loadingEmployees } = useQuery({
    queryKey: ['ranking-employees', premiacao.bu, premiacao.cargos_elegiveis],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, nome_completo, cargo, squad')
        .eq('squad', premiacao.bu)
        .in('cargo', premiacao.cargos_elegiveis);

      if (error) throw error;
      return data;
    },
  });

  // Buscar métricas de fechamento para o período
  const { data: metricas, isLoading: loadingMetricas } = useQuery({
    queryKey: ['ranking-metricas', premiacao.id, premiacao.metrica_ranking, premiacao.data_inicio, premiacao.data_fim],
    queryFn: async () => {
      // Por enquanto, retornar dados simulados
      // TODO: Integrar com fechamento_metricas_mes ou outra fonte de dados real
      return {};
    },
  });

  // Calcular ranking
  const ranking = useMemo(() => {
    if (!employees) return [];

    const metricaConfig = premiacao.metrica_config || {};
    const isInverso = metricaConfig.inverso;

    // Mapear colaboradores com suas métricas
    const participantes: ParticipanteRanking[] = employees.map((emp: any) => ({
      id: emp.id,
      nome: emp.nome_completo || 'Sem nome',
      cargo: emp.cargo || '',
      squad: emp.squad || undefined,
      valor: Math.floor(Math.random() * 100), // TODO: Usar dados reais
      posicao: 0,
      avatarUrl: undefined,
    }));

    // Ordenar por valor
    participantes.sort((a, b) => {
      if (isInverso) {
        return a.valor - b.valor; // Menor valor = melhor
      }
      return b.valor - a.valor; // Maior valor = melhor
    });

    // Atribuir posições
    return participantes.map((p, index) => ({
      ...p,
      posicao: index + 1,
    }));
  }, [employees, premiacao.metrica_config]);

  const metricaLabel = METRICAS_OPTIONS.find(m => m.value === premiacao.metrica_ranking)?.label || premiacao.metrica_ranking;

  if (loadingEmployees || loadingMetricas) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>
        ))}
      </div>
    );
  }

  if (ranking.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhum participante elegível encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top 3 em destaque */}
      <div className="grid gap-4 md:grid-cols-3">
        {ranking.slice(0, 3).map((participante, index) => (
          <TopThreeCard 
            key={participante.id} 
            participante={participante} 
            position={index + 1}
            metricaLabel={metricaLabel}
            isWinner={index < qtdGanhadores}
          />
        ))}
      </div>

      {/* Tabela completa */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Pos.</TableHead>
              <TableHead>Colaborador</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead className="text-right">{metricaLabel}</TableHead>
              <TableHead className="w-24 text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranking.map((participante) => (
              <TableRow 
                key={participante.id}
                className={cn(
                  participante.posicao <= qtdGanhadores && "bg-yellow-500/5",
                  participante.id === user?.id && "bg-primary/5 font-medium"
                )}
              >
                <TableCell>
                  <PositionBadge position={participante.posicao} isWinner={participante.posicao <= qtdGanhadores} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={participante.avatarUrl} />
                      <AvatarFallback>{participante.nome.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span>{participante.nome}</span>
                    {participante.id === user?.id && (
                      <Badge variant="outline" className="text-xs">Você</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{participante.cargo}</TableCell>
                <TableCell className="text-right font-mono font-medium">
                  {participante.valor}
                </TableCell>
                <TableCell className="text-center">
                  {participante.posicao <= qtdGanhadores ? (
                    <Badge className="bg-green-500 hover:bg-green-600">🏆</Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function TopThreeCard({ 
  participante, 
  position, 
  metricaLabel,
  isWinner 
}: { 
  participante: ParticipanteRanking; 
  position: number;
  metricaLabel: string;
  isWinner: boolean;
}) {
  const getPositionStyle = () => {
    switch (position) {
      case 1:
        return 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white';
      case 2:
        return 'bg-gradient-to-br from-gray-300 to-gray-500 text-white';
      case 3:
        return 'bg-gradient-to-br from-orange-400 to-orange-600 text-white';
      default:
        return 'bg-muted';
    }
  };

  const getIcon = () => {
    switch (position) {
      case 1:
        return <Trophy className="h-6 w-6" />;
      case 2:
        return <Medal className="h-6 w-6" />;
      case 3:
        return <Award className="h-6 w-6" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn(
      "relative rounded-lg p-4 text-center",
      position === 1 ? "md:order-2 md:-mt-4" : position === 2 ? "md:order-1" : "md:order-3",
      getPositionStyle()
    )}>
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-xl font-bold">
        {position === 1 ? '🥇' : position === 2 ? '🥈' : '🥉'}
      </div>
      
      <div className="mt-6">
        <Avatar className="h-16 w-16 mx-auto border-4 border-white/50">
          <AvatarImage src={participante.avatarUrl} />
          <AvatarFallback className="text-lg">{participante.nome.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        
        <h3 className="mt-3 font-bold text-lg">{participante.nome}</h3>
        <p className="text-sm opacity-80">{participante.cargo}</p>
        
        <div className="mt-3 p-2 bg-white/20 rounded-lg">
          <p className="text-2xl font-bold">{participante.valor}</p>
          <p className="text-xs opacity-80">{metricaLabel}</p>
        </div>
      </div>
    </div>
  );
}

function PositionBadge({ position, isWinner }: { position: number; isWinner: boolean }) {
  if (position === 1) {
    return <span className="text-2xl">🥇</span>;
  }
  if (position === 2) {
    return <span className="text-2xl">🥈</span>;
  }
  if (position === 3) {
    return <span className="text-2xl">🥉</span>;
  }
  return (
    <span className={cn(
      "font-bold",
      isWinner ? "text-yellow-600" : "text-muted-foreground"
    )}>
      #{position}
    </span>
  );
}
