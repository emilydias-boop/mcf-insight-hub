import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAllGRWallets } from '@/hooks/useGRWallet';
import { useGRWalletMetrics } from '@/hooks/useGRMetrics';
import { GRDetailHeader } from '@/components/gr/GRDetailHeader';
import { GRPerformanceTab } from '@/components/gr/GRPerformanceTab';
import { GRPartnersTab } from '@/components/gr/GRPartnersTab';
import { GRAgendaTab } from '@/components/gr/GRAgendaTab';
import { GRHistoryTab } from '@/components/gr/GRHistoryTab';
import { GRFinancialTab } from '@/components/gr/GRFinancialTab';
import { GRAuditTab } from '@/components/gr/GRAuditTab';

const GRDetail = () => {
  const { walletId } = useParams<{ walletId: string }>();
  const navigate = useNavigate();
  
  const { data: wallets = [], isLoading: walletsLoading } = useAllGRWallets();
  const { data: metrics, isLoading: metricsLoading } = useGRWalletMetrics(walletId);
  
  const wallet = wallets.find(w => w.id === walletId);
  
  if (walletsLoading || metricsLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (!wallet) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Carteira não encontrada</h2>
          <p className="text-muted-foreground mb-4">A carteira solicitada não existe ou foi removida.</p>
          <Button onClick={() => navigate('/gerentes-conta/gestao')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Gestão
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => navigate('/gerentes-conta/gestao')} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar para Gestão de Carteiras
      </Button>
      
      {/* Header with GR Info */}
      <GRDetailHeader wallet={wallet} metrics={metrics} />
      
      {/* Tabs */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="parceiros">Parceiros</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
        </TabsList>
        
        <TabsContent value="performance">
          <GRPerformanceTab walletId={walletId!} metrics={metrics} />
        </TabsContent>
        
        <TabsContent value="parceiros">
          <GRPartnersTab walletId={walletId!} />
        </TabsContent>
        
        <TabsContent value="agenda">
          <GRAgendaTab walletId={walletId!} grUserId={wallet.gr_user_id} />
        </TabsContent>
        
        <TabsContent value="historico">
          <GRHistoryTab walletId={walletId!} />
        </TabsContent>
        
        <TabsContent value="financeiro">
          <GRFinancialTab walletId={walletId!} />
        </TabsContent>
        
        <TabsContent value="auditoria">
          <GRAuditTab walletId={walletId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GRDetail;
