import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMyGRWallet, useGRWalletEntries } from '@/hooks/useGRWallet';
import { useGRWalletMetrics } from '@/hooks/useGRMetrics';
import { GREntryCard } from '@/components/gr/GREntryCard';
import { GREntryDrawer } from '@/components/gr/GREntryDrawer';
import { GRWalletStats } from '@/components/gr/GRWalletStats';
import { GRWalletEntry, GREntryStatus, GR_STATUS_LABELS } from '@/types/gr-types';
import { Search, Plus, Users, Loader2 } from 'lucide-react';

const STATUS_TABS: { value: GREntryStatus | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'ativo', label: 'Ativos' },
  { value: 'em_negociacao', label: 'Em Negociação' },
  { value: 'em_pausa', label: 'Pausados' },
  { value: 'convertido', label: 'Convertidos' },
  { value: 'inativo', label: 'Inativos' },
];

const MinhaCarteira = () => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<GREntryStatus | 'todos'>('todos');
  const [selectedEntry, setSelectedEntry] = useState<GRWalletEntry | null>(null);
  
  const { data: wallet, isLoading: walletLoading } = useMyGRWallet();
  const { data: entries = [], isLoading: entriesLoading } = useGRWalletEntries(wallet?.id);
  const { data: metrics } = useGRWalletMetrics(wallet?.id);
  
  const isLoading = walletLoading || entriesLoading;
  
  // Filtrar entradas
  const filteredEntries = entries.filter(entry => {
    const matchesSearch = !search || 
      entry.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      entry.customer_email?.toLowerCase().includes(search.toLowerCase()) ||
      entry.customer_phone?.includes(search);
    
    const matchesStatus = activeTab === 'todos' || entry.status === activeTab;
    
    return matchesSearch && matchesStatus;
  });
  
  // Contagem por status
  const statusCounts = {
    todos: entries.length,
    ativo: entries.filter(e => e.status === 'ativo').length,
    em_negociacao: entries.filter(e => e.status === 'em_negociacao').length,
    em_pausa: entries.filter(e => e.status === 'em_pausa').length,
    convertido: entries.filter(e => e.status === 'convertido').length,
    inativo: entries.filter(e => e.status === 'inativo').length,
  };
  
  if (!wallet && !walletLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma Carteira Atribuída</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Você ainda não possui uma carteira de clientes. Entre em contato com seu gestor para solicitar acesso.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Minha Carteira</h1>
          <p className="text-muted-foreground">
            Gerencie seus clientes e parceiros
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={wallet?.is_open ? 'default' : 'secondary'}>
            {wallet?.is_open ? 'Carteira Aberta' : 'Carteira Fechada'}
          </Badge>
          <Badge variant="outline">
            {wallet?.current_count || 0} / {wallet?.max_capacity || 50} clientes
          </Badge>
        </div>
      </div>
      
      {/* Métricas */}
      {metrics && <GRWalletStats metrics={metrics} />}
      
      {/* Filtros */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      
      {/* Tabs por status */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          {STATUS_TABS.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
              {tab.label}
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {statusCounts[tab.value]}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
        
        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">Nenhum cliente encontrado</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredEntries.map(entry => (
                <GREntryCard 
                  key={entry.id} 
                  entry={entry}
                  onClick={() => setSelectedEntry(entry)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Drawer de detalhes */}
      <GREntryDrawer
        entry={selectedEntry}
        open={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />
    </div>
  );
};

export default MinhaCarteira;
