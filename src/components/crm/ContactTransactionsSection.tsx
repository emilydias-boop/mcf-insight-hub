import { useCustomerTransactions } from '@/hooks/useCustomerTransactions';
import { useCustomerJourney } from '@/hooks/useCustomerJourney';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, ShoppingCart, DollarSign } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContactTransactionsSectionProps {
  email: string | null;
}

export function ContactTransactionsSection({ email }: ContactTransactionsSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const { data: transactions, isLoading } = useCustomerTransactions(email);
  const { data: journey } = useCustomerJourney(email);

  if (isLoading) {
    return <Skeleton className="h-20 w-full" />;
  }

  if (!transactions || transactions.length === 0) return null;

  const totalInvested = journey?.totalInvested || transactions.reduce((sum, t) => sum + (t.net_value || 0), 0);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 rounded-lg border bg-secondary/30 hover:bg-secondary/50 transition-colors">
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <ShoppingCart className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold flex-1 text-left">
          Compras / Transações ({transactions.length})
        </span>
        <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">
          <DollarSign className="h-3 w-3 mr-0.5" />
          R$ {totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-1.5">
        {transactions.map((tx) => (
          <div key={tx.id} className="p-2.5 rounded-lg border bg-card text-sm flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground truncate">{tx.product_name}</p>
              <p className="text-xs text-muted-foreground">
                {tx.sale_date ? format(new Date(tx.sale_date), "dd/MM/yyyy", { locale: ptBR }) : '—'}
                {tx.source && (
                  <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0">{tx.source}</Badge>
                )}
                {tx.installment_number && tx.total_installments && (
                  <span className="ml-1.5">
                    Parcela {tx.installment_number}/{tx.total_installments}
                  </span>
                )}
              </p>
            </div>
            <span className="text-xs font-semibold text-green-600 whitespace-nowrap">
              R$ {(tx.net_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}
        
        {journey && (
          <div className="p-2.5 rounded-lg border border-dashed bg-muted/30 text-xs text-muted-foreground space-y-1">
            {journey.firstA010Date && (
              <p>🎯 Primeiro A010: {format(new Date(journey.firstA010Date), "dd/MM/yyyy", { locale: ptBR })}</p>
            )}
            {journey.firstContractDate && (
              <p>📄 Primeiro Contrato: {format(new Date(journey.firstContractDate), "dd/MM/yyyy", { locale: ptBR })}</p>
            )}
            {journey.daysToContract !== null && (
              <p>⏱️ Dias até contrato: {journey.daysToContract} dias</p>
            )}
            {journey.currentInstallment && journey.totalInstallments && (
              <p>💳 Parcela atual: {journey.currentInstallment}/{journey.totalInstallments}
                {journey.isOverdue && <Badge variant="destructive" className="ml-1 text-[10px] px-1 py-0">Atrasado</Badge>}
              </p>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
