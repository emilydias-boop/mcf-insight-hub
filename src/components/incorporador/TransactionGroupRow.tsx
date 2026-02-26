import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronDown, ChevronRight, Eye, Pencil, Trash2, UserPlus, UserCheck, Package } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';


import { HublaTransaction } from '@/hooks/useAllHublaTransactions';
import { formatCurrency } from '@/lib/formatters';
import { getDeduplicatedGross, getFixedGrossPrice } from '@/lib/incorporadorPricing';

export interface TransactionGroup {
  id: string; // baseId (hubla_id sem -offer-X)
  main: HublaTransaction;
  orderBumps: HublaTransaction[];
  allTransactions: HublaTransaction[]; // Todas as transações do grupo
  totalGross: number;
  totalNet: number;
  isFirst: boolean; // Se é primeira compra (para badge Novo/Recorrente)
}

interface TransactionGroupRowProps {
  group: TransactionGroup;
  globalFirstIds: Set<string>;
  onViewDetails: (transaction: HublaTransaction) => void;
  onEdit: (transaction: HublaTransaction) => void;
  onDelete: (transaction: HublaTransaction) => void;
}

export function TransactionGroupRow({
  group,
  globalFirstIds,
  onViewDetails,
  onEdit,
  onDelete,
}: TransactionGroupRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasOrderBumps = group.orderBumps.length > 0;
  const { main } = group;

  // Calcula bruto individual de uma transação
  const getIndividualGross = (tx: HublaTransaction): number => {
    const isFirst = globalFirstIds.has(tx.id);
    return getDeduplicatedGross(tx, isFirst);
  };

  // Linha principal consolidada
  const MainRow = () => (
    <TableRow 
      className={`${main.sale_status === 'refunded' ? 'bg-destructive/10' : ''} ${hasOrderBumps ? 'cursor-pointer hover:bg-muted/50' : ''}`}
      onClick={hasOrderBumps ? () => setIsOpen(!isOpen) : undefined}
    >
      {/* Indicador de expansão + Data */}
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {hasOrderBumps && (
            <span className="text-muted-foreground">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
          )}
          {!hasOrderBumps && <span className="w-4" />}
          <span>{main.sale_date ? format(new Date(main.sale_date), 'dd/MM/yy HH:mm', { locale: ptBR }) : '-'}</span>
        </div>
      </TableCell>

      {/* Produto com badge de bumps */}
      <TableCell className="max-w-[200px]">
        <div className="flex items-center gap-2">
          <span className="truncate" title={main.product_name || ''}>
            {main.product_name || '-'}
          </span>
          {hasOrderBumps && (
            <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
              <Package className="h-3 w-3 mr-1" />
              +{group.orderBumps.length} bump{group.orderBumps.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </TableCell>

      {/* Cliente */}
      <TableCell>
        <div className="max-w-[180px]">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium" title={main.customer_name || ''}>
              {main.customer_name || '-'}
            </span>
            {main.sale_status === 'refunded' && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">
                Reembolso
              </Badge>
            )}
          </div>
          <div className="truncate text-xs text-muted-foreground" title={main.customer_email || ''}>
            {main.customer_email || '-'}
          </div>
        </div>
      </TableCell>

      {/* Parcela */}
      <TableCell className="text-center">
        {main.installment_number && main.total_installments 
          ? `${main.installment_number}/${main.total_installments}` 
          : '1/1'}
      </TableCell>

      {/* Bruto Total */}
      <TableCell className="text-right font-medium">
        {hasOrderBumps ? (
          <span className={!group.isFirst ? "text-muted-foreground" : ""}>
            {formatCurrency(group.totalGross)}
            {!group.isFirst && (
              <span className="ml-1 text-xs" title="Bruto zerado - cliente já contabilizado">
                (dup)
              </span>
            )}
          </span>
        ) : (
          (() => {
            const isFirst = globalFirstIds.has(main.id);
            const brutoValue = getDeduplicatedGross(main, isFirst);
            return (
              <span className={!isFirst ? "text-muted-foreground" : ""}>
                {formatCurrency(brutoValue)}
                {!isFirst && (
                  <span className="ml-1 text-xs" title="Bruto zerado - cliente já contabilizado neste produto">
                    (dup)
                  </span>
                )}
              </span>
            );
          })()
        )}
      </TableCell>

      {/* Líquido Total */}
      <TableCell className="text-right text-primary font-medium">
        {formatCurrency(group.totalNet)}
      </TableCell>

      {/* Fonte */}
      <TableCell>
        <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-muted">
          {main.source || 'hubla'}
        </span>
      </TableCell>

      {/* Tipo */}
      <TableCell className="text-center">
        {group.isFirst ? (
          <span 
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium bg-primary/10 text-primary"
            title="Primeira compra deste cliente neste produto"
          >
            <UserPlus className="h-3 w-3" />
            Novo
          </span>
        ) : (
          <span 
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium bg-secondary text-secondary-foreground"
            title="Cliente já comprou este produto anteriormente"
          >
            <UserCheck className="h-3 w-3" />
            Recorrente
          </span>
        )}
      </TableCell>

      {/* Ações */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={() => onViewDetails(main)}
            title="Ver detalhes"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={() => onEdit(main)}
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {main.source === 'manual' && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={() => onDelete(main)}
              title="Excluir"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  // Linhas expandidas (detalhes de cada item)
  const ExpandedRows = () => (
    <>
      {group.allTransactions.map((tx, index) => {
        const isLast = index === group.allTransactions.length - 1;
        const isOrderBump = tx.hubla_id?.includes('-offer-');
        const bruto = getIndividualGross(tx);
        const isFirst = globalFirstIds.has(tx.id);

        return (
          <TableRow 
            key={tx.id} 
            className="bg-muted/30 border-l-2 border-l-primary/20"
          >
            {/* Hierarquia visual + Data */}
            <TableCell className="font-medium text-muted-foreground">
              <div className="flex items-center gap-2 pl-6">
                <span className="text-xs font-mono">
                  {isLast ? '└─' : '├─'}
                </span>
                <span className="text-sm">
                  {tx.sale_date ? format(new Date(tx.sale_date), 'HH:mm', { locale: ptBR }) : '-'}
                </span>
              </div>
            </TableCell>

            {/* Produto com badge */}
            <TableCell className="max-w-[200px]">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm" title={tx.product_name || ''}>
                  {tx.product_name || '-'}
                </span>
                <Badge 
                  variant={isOrderBump ? 'outline' : 'default'} 
                  className="shrink-0 text-[10px] px-1.5 py-0"
                >
                  {isOrderBump ? 'Bump' : 'Principal'}
                </Badge>
              </div>
            </TableCell>

            {/* Cliente (vazio pois já mostrado na linha principal) */}
            <TableCell></TableCell>

            {/* Parcela */}
            <TableCell className="text-center text-sm text-muted-foreground">
              {tx.installment_number && tx.total_installments 
                ? `${tx.installment_number}/${tx.total_installments}` 
                : '1/1'}
            </TableCell>

            {/* Bruto individual */}
            <TableCell className="text-right text-sm">
              <span className={!isFirst ? "text-muted-foreground" : ""}>
                {formatCurrency(bruto)}
                {!isFirst && bruto === 0 && (
                  <span className="ml-1 text-xs">(dup)</span>
                )}
              </span>
            </TableCell>

            {/* Líquido individual */}
            <TableCell className="text-right text-sm text-primary">
              {formatCurrency(tx.net_value || 0)}
            </TableCell>

            {/* Fonte */}
            <TableCell>
              <span className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium bg-muted">
                {tx.source || 'hubla'}
              </span>
            </TableCell>

            {/* Tipo */}
            <TableCell className="text-center">
              {isFirst ? (
                <span className="text-[10px] text-primary">Novo</span>
              ) : (
                <span className="text-[10px] text-muted-foreground">Recorrente</span>
              )}
            </TableCell>

            {/* Ações individuais */}
            <TableCell>
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6" 
                  onClick={() => onViewDetails(tx)}
                  title="Ver detalhes"
                >
                  <Eye className="h-3 w-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6" 
                  onClick={() => onEdit(tx)}
                  title="Editar"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );

  if (!hasOrderBumps) {
    return <MainRow />;
  }

  return (
    <>
      <MainRow />
      {isOpen && <ExpandedRows />}
    </>
  );
}

// Função de agrupamento por compra (hubla_id base)
export function groupTransactionsByPurchase(
  transactions: HublaTransaction[],
  globalFirstIds: Set<string>
): TransactionGroup[] {
  const groups = new Map<string, TransactionGroup>();

  transactions.forEach(tx => {
    // Remove sufixo -offer-X para agrupar
    const baseId = tx.hubla_id?.replace(/-offer-\d+$/, '') || tx.id;
    const isOrderBump = tx.hubla_id?.includes('-offer-');

    if (!groups.has(baseId)) {
      groups.set(baseId, {
        id: baseId,
        main: tx, // Será substituído se encontrar o principal
        orderBumps: [],
        allTransactions: [],
        totalGross: 0,
        totalNet: 0,
        isFirst: false,
      });
    }

    const group = groups.get(baseId)!;
    group.allTransactions.push(tx);

    if (isOrderBump) {
      group.orderBumps.push(tx);
    } else {
      // É o produto principal
      group.main = tx;
    }

    // Soma bruto e líquido
    const isFirst = globalFirstIds.has(tx.id);
    group.totalGross += getDeduplicatedGross(tx, isFirst);
    group.totalNet += tx.net_value || 0;

    // Marca grupo como "primeiro" se o produto principal for primeiro
    if (!isOrderBump && isFirst) {
      group.isFirst = true;
    }
  });

  // Segunda passagem: recalcular totais para grupos com orderBumps
  // O main da Hubla tem net = soma de todos os offers, então somar main + offers duplica
  groups.forEach(group => {
    if (group.orderBumps.length > 0) {
      // Recalcular totalNet usando apenas os offers (exclui o main que é o "carrinho total")
      group.totalNet = group.orderBumps.reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      // Recalcular totalGross: tenta usar apenas offers, mas se zerado, usa todos
      // Isso evita descartar bruto válido do item principal em grupos mistos
      const grossOffersOnly = group.orderBumps.reduce((sum, tx) => {
        const isFirst = globalFirstIds.has(tx.id);
        return sum + getDeduplicatedGross(tx, isFirst);
      }, 0);

      if (grossOffersOnly > 0) {
        group.totalGross = grossOffersOnly;
      }
      // Se grossOffersOnly === 0, mantém o totalGross já calculado na primeira passagem
      // (que inclui o bruto do item principal)
    }

    // Ordena allTransactions: principal primeiro, depois bumps
    group.allTransactions.sort((a, b) => {
      const aIsBump = a.hubla_id?.includes('-offer-') ? 1 : 0;
      const bIsBump = b.hubla_id?.includes('-offer-') ? 1 : 0;
      return aIsBump - bIsBump;
    });
  });

  return Array.from(groups.values());
}
