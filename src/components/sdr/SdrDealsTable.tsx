import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Phone, Mail, ExternalLink } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SdrDeal } from '@/hooks/useSdrDeals';
import { formatCurrency } from '@/lib/formatters';

interface SdrDealsTableProps {
  deals: SdrDeal[];
  isLoading: boolean;
}

export const SdrDealsTable = ({ deals, isLoading }: SdrDealsTableProps) => {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (deals.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum negócio encontrado para este SDR.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome do Negócio</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Estágio</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Atualizado</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deals.map((deal) => (
            <TableRow key={deal.id}>
              <TableCell className="font-medium max-w-[200px] truncate">
                {deal.name}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {deal.contact_name && (
                    <span className="text-sm">{deal.contact_name}</span>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {deal.contact_phone && (
                      <a
                        href={`https://wa.me/${deal.contact_phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-primary"
                      >
                        <Phone className="h-3 w-3" />
                      </a>
                    )}
                    {deal.contact_email && (
                      <a
                        href={`mailto:${deal.contact_email}`}
                        className="flex items-center gap-1 hover:text-primary"
                      >
                        <Mail className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {deal.origin_name || 'Sem origem'}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="text-xs">
                  {deal.stage_name || 'Sem estágio'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {deal.value ? formatCurrency(deal.value) : '-'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(deal.updated_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  title="Ver no CRM"
                >
                  <a href={`/crm/negocios?deal=${deal.id}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
