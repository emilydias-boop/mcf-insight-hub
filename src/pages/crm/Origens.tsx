import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useClintOrigins } from '@/hooks/useClintAPI';
import { Search, Plus, MapPin, TrendingUp, Target, Edit, BarChart3 } from 'lucide-react';

const Origens = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: origins, isLoading } = useClintOrigins();

  const originsData = origins?.data || [];
  const filteredOrigins = originsData.filter((origin: any) =>
    origin.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalOrigins = originsData.length;
  const activeOrigins = originsData.filter((o: any) => o.is_active !== false).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Gerenciamento de Origens</h2>
          <p className="text-muted-foreground">Gerencie os canais de captação de leads</p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Nova Origem
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Origens
            </CardTitle>
            <MapPin className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-foreground">{totalOrigins}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Canais cadastrados</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Origens Ativas
            </CardTitle>
            <Target className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-foreground">{activeOrigins}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Em operação</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Utilização
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-foreground">
                {totalOrigins > 0 ? Math.round((activeOrigins / totalOrigins) * 100) : 0}%
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Origens em uso</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar origens por nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-card border-border text-foreground"
        />
      </div>

      {/* Origins List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : filteredOrigins.length > 0 ? (
        <div className="space-y-4">
          {filteredOrigins.map((origin: any) => (
            <Card key={origin.id} className="bg-card border-border hover:border-primary/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-6 w-6 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">{origin.name}</h3>
                        {origin.is_active !== false && (
                          <Badge className="bg-success/10 text-success border-0">Ativa</Badge>
                        )}
                      </div>

                      {origin.description && (
                        <p className="text-sm text-muted-foreground mb-3">{origin.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <BarChart3 className="h-4 w-4" />
                          <span>ID: {origin.id.slice(0, 8)}</span>
                        </div>
                        {origin.created_at && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span>Criado em {new Date(origin.created_at).toLocaleDateString('pt-BR')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button variant="outline" size="sm" className="border-border">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Stats
                    </Button>
                    <Button variant="outline" size="sm" className="border-border">
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {searchTerm ? 'Nenhuma origem encontrada' : 'Nenhuma origem cadastrada'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm
                ? 'Tente buscar com outros termos'
                : 'Comece adicionando seus canais de captação de leads'}
            </p>
            {!searchTerm && (
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Origem
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Origens;
