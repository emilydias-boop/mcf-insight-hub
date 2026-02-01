import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trophy, Calendar, Users, Filter } from 'lucide-react';
import { format, isPast, isFuture, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePremiacoes } from '@/hooks/usePremiacoes';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useActiveBU } from '@/hooks/useActiveBU';
import { BU_OPTIONS } from '@/hooks/useMyBU';
import { Premiacao, PremiacaoStatus } from '@/types/premiacoes';
import PremiacaoCard from '@/components/premiacoes/PremiacaoCard';
import { Skeleton } from '@/components/ui/skeleton';

export default function PremiacoesIndex() {
  const { isAdmin } = useMyPermissions();
  const activeBU = useActiveBU();
  const [selectedBU, setSelectedBU] = useState<string>(activeBU || 'all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  
  const { data: premiacoes, isLoading } = usePremiacoes(
    selectedBU !== 'all' ? selectedBU : undefined,
    selectedStatus !== 'all' ? selectedStatus : undefined
  );

  const canCreate = isAdmin;

  const categorizePremiacoes = (items: Premiacao[] = []) => {
    const now = new Date();
    
    return {
      ativas: items.filter(p => 
        p.status === 'ativa' && 
        isWithinInterval(now, { 
          start: parseISO(p.data_inicio), 
          end: parseISO(p.data_fim) 
        })
      ),
      proximas: items.filter(p => 
        p.status === 'ativa' && isFuture(parseISO(p.data_inicio))
      ),
      rascunhos: items.filter(p => 
        p.status === 'rascunho'
      ),
      encerradas: items.filter(p => 
        p.status === 'encerrada' || 
        (p.status === 'ativa' && isPast(parseISO(p.data_fim)))
      ),
    };
  };

  const categorized = categorizePremiacoes(premiacoes);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Premiações
          </h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe as campanhas de premiação e seu ranking
          </p>
        </div>
        
        {canCreate && (
          <Button asChild>
            <Link to="/premiacoes/nova">
              <Plus className="h-4 w-4 mr-2" />
              Nova Premiação
            </Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtros:</span>
            </div>
            
            <Select value={selectedBU} onValueChange={setSelectedBU}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todas as BUs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as BUs</SelectItem>
                {BU_OPTIONS.filter(bu => bu.value).map(bu => (
                  <SelectItem key={bu.value} value={bu.value}>
                    {bu.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="encerrada">Encerrada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Tabs defaultValue="ativas" className="space-y-4">
          <TabsList>
            <TabsTrigger value="ativas" className="gap-2">
              Em Andamento
              {categorized.ativas.length > 0 && (
                <Badge variant="secondary">{categorized.ativas.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="proximas" className="gap-2">
              Próximas
              {categorized.proximas.length > 0 && (
                <Badge variant="outline">{categorized.proximas.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="rascunhos" className="gap-2">
              Rascunhos
              {categorized.rascunhos.length > 0 && (
                <Badge variant="secondary">{categorized.rascunhos.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="encerradas" className="gap-2">
              Encerradas
              {categorized.encerradas.length > 0 && (
                <Badge variant="outline">{categorized.encerradas.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ativas">
            {categorized.ativas.length === 0 ? (
              <EmptyState message="Nenhuma premiação em andamento" />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {categorized.ativas.map(premiacao => (
                  <PremiacaoCard key={premiacao.id} premiacao={premiacao} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="proximas">
            {categorized.proximas.length === 0 ? (
              <EmptyState message="Nenhuma premiação programada" />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {categorized.proximas.map(premiacao => (
                  <PremiacaoCard key={premiacao.id} premiacao={premiacao} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rascunhos">
            {categorized.rascunhos.length === 0 ? (
              <EmptyState message="Nenhum rascunho" />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {categorized.rascunhos.map(premiacao => (
                  <PremiacaoCard key={premiacao.id} premiacao={premiacao} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="encerradas">
            {categorized.encerradas.length === 0 ? (
              <EmptyState message="Nenhuma premiação encerrada" />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {categorized.encerradas.map(premiacao => (
                  <PremiacaoCard key={premiacao.id} premiacao={premiacao} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="py-12">
      <CardContent className="text-center">
        <Trophy className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
