import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClintDeals } from '@/hooks/useClintAPI';
import { Search, Plus, LayoutGrid, List } from 'lucide-react';
import { DealKanbanBoard } from '@/components/crm/DealKanbanBoard';
import { Skeleton } from '@/components/ui/skeleton';

const Negocios = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: deals, isLoading } = useClintDeals();

  const dealsData = deals?.data || [];
  const filteredDeals = dealsData.filter((deal: any) =>
    deal.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Pipeline de Vendas</h2>
          <p className="text-muted-foreground">Gerencie seus negócios e oportunidades</p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Novo Negócio
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar negócios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card border-border text-foreground"
          />
        </div>
      </div>

      <Tabs defaultValue="kanban" className="w-full">
        <TabsList className="bg-muted">
          <TabsTrigger value="kanban" className="data-[state=active]:bg-card">
            <LayoutGrid className="h-4 w-4 mr-2" />
            Kanban
          </TabsTrigger>
          <TabsTrigger value="list" className="data-[state=active]:bg-card">
            <List className="h-4 w-4 mr-2" />
            Lista
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-6">
          {isLoading ? (
            <div className="flex gap-4 overflow-x-auto">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="w-80 h-96 flex-shrink-0" />
              ))}
            </div>
          ) : (
            <DealKanbanBoard deals={filteredDeals} />
          )}
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          <div className="bg-card rounded-lg border border-border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Nome</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Valor</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Estágio</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Probabilidade</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Previsão</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeals.map((deal: any) => (
                    <tr key={deal.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                      <td className="p-4">
                        <div className="font-medium text-foreground">{deal.name}</div>
                      </td>
                      <td className="p-4">
                        <span className="font-semibold text-success">
                          R$ {(deal.value || 0).toLocaleString('pt-BR')}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm px-2 py-1 rounded-full bg-primary/10 text-primary">
                          {deal.stage}
                        </span>
                      </td>
                      <td className="p-4">
                        {deal.probability && (
                          <span className="text-sm text-muted-foreground">
                            {deal.probability}%
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        {deal.expected_close_date && (
                          <span className="text-sm text-muted-foreground">
                            {new Date(deal.expected_close_date).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredDeals.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-muted-foreground">
                        Nenhum negócio encontrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Negocios;
