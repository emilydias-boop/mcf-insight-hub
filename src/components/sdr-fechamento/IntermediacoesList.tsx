import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Package, DollarSign, Calendar, Database, FileText } from 'lucide-react';
import { SdrIntermediacao } from '@/types/sdr-fechamento';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useSdrContractsFromAgenda } from '@/hooks/useSdrContractsFromAgenda';

interface IntermediacoesListProps {
  sdrId: string;
  anoMes: string;
  disabled?: boolean;
  isCloser?: boolean;
}

export const IntermediacoesList = ({
  sdrId,
  anoMes,
  disabled = false,
  isCloser = false,
}: IntermediacoesListProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<string>('');
  const [observacao, setObservacao] = useState('');
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Para SDRs: buscar contratos da Agenda (mesma fonte do indicador)
  const { data: agendaContracts, isLoading: isLoadingAgenda } = useSdrContractsFromAgenda(
    !isCloser ? sdrId : undefined,
    !isCloser ? anoMes : undefined
  );

  // Fetch intermediações manuais (legadas / fallback)
  const { data: intermediacoes, isLoading: isLoadingManual } = useQuery({
    queryKey: ['sdr-intermediacoes', sdrId, anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sdr_intermediacoes')
        .select('*')
        .eq('sdr_id', sdrId)
        .eq('ano_mes', anoMes)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SdrIntermediacao[];
    },
  });

  // Determinar fonte: Agenda tem prioridade para SDRs
  const useAgendaSource = !isCloser && (agendaContracts?.length || 0) > 0;
  const isLoading = isCloser ? isLoadingManual : (isLoadingAgenda || isLoadingManual);

  // Fetch Hubla transactions for the month (contracts only)
  const { data: transactions } = useQuery({
    queryKey: ['hubla-contracts', anoMes],
    queryFn: async () => {
      const [year, month] = anoMes.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const { data, error } = await supabase
        .from('hubla_transactions')
        .select('id, product_name, net_value, customer_name, sale_date')
        .gte('sale_date', startDate.toISOString())
        .lte('sale_date', endDate.toISOString())
        .or('product_name.ilike.%Contrato%,product_name.ilike.%A000%,product_name.ilike.%MCF%,product_name.ilike.%Incorporador%')
        .order('sale_date', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !useAgendaSource, // Só buscar Hubla se não usar Agenda
  });

  // Add intermediação mutation
  const addIntermediacao = useMutation({
    mutationFn: async () => {
      if (!selectedTransaction) {
        throw new Error('Selecione uma transação');
      }

      const transaction = transactions?.find(t => t.id === selectedTransaction);
      if (!transaction) {
        throw new Error('Transação não encontrada');
      }

      const { data, error } = await supabase
        .from('sdr_intermediacoes')
        .insert({
          sdr_id: sdrId,
          ano_mes: anoMes,
          hubla_transaction_id: selectedTransaction,
          produto_nome: transaction.product_name,
          valor_venda: transaction.net_value,
          observacao: observacao || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sdr-intermediacoes', sdrId, anoMes] });
      toast.success('Intermediação adicionada com sucesso');
      setIsOpen(false);
      setSelectedTransaction('');
      setObservacao('');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao adicionar: ${error.message}`);
    },
  });

  const selectedTransactionData = transactions?.find(t => t.id === selectedTransaction);

  // Mostrar botão Adicionar apenas no modo manual (Closer ou fallback)
  const showAddButton = !disabled && (isCloser || !useAgendaSource);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">
            {isCloser ? 'Vendas Parceria' : 'Intermediações de Contrato'}
          </CardTitle>
          {useAgendaSource && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Database className="h-3 w-3" />
              Fonte: Agenda (mesma base do indicador)
            </p>
          )}
        </div>
        {showAddButton && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Intermediação</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Selecione a Venda</Label>
                  <Select value={selectedTransaction} onValueChange={setSelectedTransaction}>
                    <SelectTrigger>
                      <SelectValue placeholder="Buscar transação..." />
                    </SelectTrigger>
                    <SelectContent>
                      {transactions?.map((tx) => (
                        <SelectItem key={tx.id} value={tx.id}>
                          <div className="flex flex-col">
                            <span>{tx.customer_name || 'Sem nome'}</span>
                            <span className="text-xs text-muted-foreground">
                              {tx.product_name} - {formatCurrency(tx.net_value || 0)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedTransactionData && (
                  <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{selectedTransactionData.product_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span>{formatCurrency(selectedTransactionData.net_value || 0)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{formatDate(selectedTransactionData.sale_date)}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="observacao">Observação (opcional)</Label>
                  <Input
                    id="observacao"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="Ex: Parceria com Closer X"
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={() => addIntermediacao.mutate()}
                  disabled={!selectedTransaction || addIntermediacao.isPending}
                >
                  Adicionar Intermediação
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Carregando...</div>
        ) : useAgendaSource ? (
          // === MODO AGENDA: lista de contratos da Agenda ===
          <div className="space-y-3">
            {agendaContracts!.map((contract) => (
              <div
                key={contract.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="space-y-1">
                  <div className="font-medium">{contract.leadName}</div>
                  {contract.closerName && (
                    <div className="text-sm text-muted-foreground">
                      Closer: {contract.closerName}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Pago em {formatDate(contract.contractPaidAt)}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  {contract.contactEmail && (
                    <div className="text-xs text-muted-foreground">{contract.contactEmail}</div>
                  )}
                  {contract.contactPhone && (
                    <div className="text-xs text-muted-foreground">{contract.contactPhone}</div>
                  )}
                </div>
              </div>
            ))}
            <div className="pt-3 border-t flex items-center justify-between">
              <span className="font-medium">Total de Contratos</span>
              <span className="font-bold text-lg">{agendaContracts!.length}</span>
            </div>
          </div>
        ) : !intermediacoes || intermediacoes.length === 0 ? (
          // === SEM DADOS ===
          <div className="text-center py-4 text-muted-foreground">
            Nenhuma intermediação registrada para este mês.
          </div>
        ) : (
          // === MODO MANUAL/LEGADO ===
          <div className="space-y-3">
            {intermediacoes.map((inter) => (
              <div
                key={inter.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="space-y-1">
                  <div className="font-medium">{inter.produto_nome || 'Produto'}</div>
                  {inter.observacao && (
                    <div className="text-sm text-muted-foreground">{inter.observacao}</div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {formatDate(inter.created_at)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-primary">
                    {formatCurrency(inter.valor_venda || 0)}
                  </div>
                </div>
              </div>
            ))}
            <div className="pt-3 border-t flex items-center justify-between">
              <span className="font-medium">Total de Intermediações</span>
              <span className="font-bold text-lg">{intermediacoes.length}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
