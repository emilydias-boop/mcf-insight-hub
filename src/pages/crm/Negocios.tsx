import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useClintDeals } from '@/hooks/useClintAPI';
import { Search, Plus, Briefcase, DollarSign, Calendar } from 'lucide-react';

const Negocios = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: deals, isLoading } = useClintDeals();

  const dealsData = deals?.data || [];
  const filteredDeals = dealsData.filter((deal: any) =>
    deal.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      lead: 'bg-muted text-muted-foreground',
      qualified: 'bg-primary/10 text-primary',
      proposal: 'bg-warning/10 text-warning',
      negotiation: 'bg-warning/20 text-warning',
      won: 'bg-success/10 text-success',
      lost: 'bg-destructive/10 text-destructive',
    };
    return colors[stage?.toLowerCase()] || 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Negócios</h2>
          <p className="text-muted-foreground">Pipeline de vendas e oportunidades</p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Novo Negócio
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar negócios..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-card border-border text-foreground"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : filteredDeals.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDeals.map((deal: any) => (
            <Card key={deal.id} className="bg-card border-border hover:border-primary/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Briefcase className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{deal.name}</h3>
                      <Badge className={`mt-1 ${getStageColor(deal.stage)} border-0`}>
                        {deal.stage}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Valor
                    </span>
                    <span className="font-semibold text-success">
                      R$ {(deal.value || 0).toLocaleString('pt-BR')}
                    </span>
                  </div>

                  {deal.probability && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Probabilidade</span>
                      <span className="font-medium text-foreground">{deal.probability}%</span>
                    </div>
                  )}

                  {deal.expected_close_date && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Previsão: {new Date(deal.expected_close_date).toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {searchTerm ? 'Nenhum negócio encontrado' : 'Nenhum negócio cadastrado'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm
                ? 'Tente buscar com outros termos'
                : 'Comece criando suas primeiras oportunidades'}
            </p>
            {!searchTerm && (
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Criar Negócio
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Negocios;
