import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FinanceiroPagamentos } from '@/components/financeiro/FinanceiroPagamentos';
import { FinanceiroReceitas } from '@/components/financeiro/FinanceiroReceitas';
import { FinanceiroTransacoes } from '@/components/financeiro/FinanceiroTransacoes';

const Financeiro = () => {
  const { role } = useAuth();
  
  // Only admin and financeiro roles can access
  const allowedRoles = ['admin', 'financeiro'];
  if (!role || !allowedRoles.includes(role)) {
    toast.error('Acesso negado ao módulo Financeiro');
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
        <p className="text-muted-foreground">Gestão de pagamentos e receitas</p>
      </div>

      <Tabs defaultValue="pagamentos" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
          <TabsTrigger value="transacoes">Transações</TabsTrigger>
          <TabsTrigger value="receitas">Receitas</TabsTrigger>
        </TabsList>

        <TabsContent value="pagamentos" className="mt-6">
          <FinanceiroPagamentos />
        </TabsContent>

        <TabsContent value="transacoes" className="mt-6">
          <FinanceiroTransacoes />
        </TabsContent>

        <TabsContent value="receitas" className="mt-6">
          <FinanceiroReceitas />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Financeiro;
