import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { useAllGRWallets, useUpdateGRWallet, useCreateGRWallet } from '@/hooks/useGRWallet';
import { useAllGRMetrics } from '@/hooks/useGRMetrics';
import { GRWalletStats } from '@/components/gr/GRWalletStats';
import { CreateGRWalletDialog } from '@/components/gr/CreateGRWalletDialog';
import { GRDistributionPanel } from '@/components/gr/GRDistributionPanel';
import { Users, Settings, Plus, Loader2, Briefcase } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const GestaoCarteiras = () => {
  const navigate = useNavigate();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDistributionPanel, setShowDistributionPanel] = useState(false);
  
  const { data: wallets = [], isLoading } = useAllGRWallets();
  const { data: metrics } = useAllGRMetrics();
  const updateWallet = useUpdateGRWallet();
  
  const handleToggleWallet = (walletId: string, currentStatus: boolean) => {
    updateWallet.mutate({ id: walletId, is_open: !currentStatus });
  };
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Carteiras</h1>
          <p className="text-muted-foreground">
            Gerencie as carteiras dos Gerentes de Conta
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowDistributionPanel(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Configurar Distribuição
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Carteira
          </Button>
        </div>
      </div>
      
      {/* Métricas Gerais */}
      {metrics && <GRWalletStats metrics={metrics} title="Métricas Gerais" />}
      
      {/* Tabela de Carteiras */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Carteiras dos GRs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : wallets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma carteira cadastrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GR</TableHead>
                  <TableHead>BU</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Clientes</TableHead>
                  <TableHead className="text-center">Capacidade</TableHead>
                  <TableHead className="text-center">Ocupação</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallets.map(wallet => {
                  const ocupacao = wallet.max_capacity > 0 
                    ? Math.round((wallet.current_count / wallet.max_capacity) * 100) 
                    : 0;
                  
                  return (
                    <TableRow key={wallet.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{wallet.gr_name || 'N/A'}</p>
                          <p className="text-sm text-muted-foreground">{wallet.gr_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{wallet.bu.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={wallet.is_open ? 'default' : 'secondary'}>
                          {wallet.is_open ? 'Aberta' : 'Fechada'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {wallet.current_count}
                      </TableCell>
                      <TableCell className="text-center">
                        {wallet.max_capacity}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={ocupacao >= 90 ? 'destructive' : ocupacao >= 70 ? 'secondary' : 'outline'}
                        >
                          {ocupacao}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDistanceToNow(new Date(wallet.created_at), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Switch
                            checked={wallet.is_open}
                            onCheckedChange={() => handleToggleWallet(wallet.id, wallet.is_open)}
                          />
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate(`/gerentes-conta/gestao/${wallet.id}`)}
                          >
                            Gerenciar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* Dialogs */}
      <CreateGRWalletDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />
      
      <GRDistributionPanel
        open={showDistributionPanel}
        onClose={() => setShowDistributionPanel(false)}
      />
    </div>
  );
};

export default GestaoCarteiras;
