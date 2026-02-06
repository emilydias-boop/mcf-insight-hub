import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGRWalletEntries } from '@/hooks/useGRWallet';
import { useGREntryActions } from '@/hooks/useGRActions';
import { GR_STATUS_LABELS, GR_ACTION_LABELS, GREntryStatus, GRActionType } from '@/types/gr-types';
import { formatDateTime } from '@/lib/formatters';
import { History, ArrowRight, Loader2 } from 'lucide-react';

interface GRHistoryTabProps {
  walletId: string;
}

export const GRHistoryTab = ({ walletId }: GRHistoryTabProps) => {
  const { data: entries = [], isLoading } = useGRWalletEntries(walletId);
  
  // Group entries by status for summary
  const statusGroups = entries.reduce((acc, entry) => {
    const status = entry.status as GREntryStatus;
    if (!acc[status]) acc[status] = [];
    acc[status].push(entry);
    return acc;
  }, {} as Record<string, typeof entries>);
  
  // Get convertidos and transferidos for tracking destination
  const convertidos = entries.filter(e => e.status === 'convertido');
  const transferidos = entries.filter(e => e.status === 'transferido');
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(GR_STATUS_LABELS).map(([status, { label, color }]) => (
          <Card key={status}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{label}</span>
                <Badge variant="outline" className={color}>
                  {statusGroups[status]?.length || 0}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Converted Leads */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Leads Convertidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {convertidos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum lead convertido ainda
            </p>
          ) : (
            <div className="space-y-3">
              {convertidos.map((entry) => (
                <div 
                  key={entry.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-primary/5"
                >
                  <div>
                    <p className="font-medium">{entry.customer_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Produto: {entry.product_purchased || 'Não especificado'}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-primary/20 text-primary border-primary/30">
                      Convertido
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDateTime(entry.updated_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Transferred Leads */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Leads Transferidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transferidos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum lead transferido
            </p>
          ) : (
            <div className="space-y-3">
              {transferidos.map((entry) => (
                <div 
                  key={entry.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-purple-500/5"
                >
                  <div>
                    <p className="font-medium">{entry.customer_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Origem: {entry.entry_source}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                      Transferido
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDateTime(entry.updated_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Lost Leads */}
      <Card>
        <CardHeader>
          <CardTitle>Leads Inativos</CardTitle>
        </CardHeader>
        <CardContent>
          {(statusGroups['inativo']?.length || 0) === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum lead inativo
            </p>
          ) : (
            <div className="space-y-3">
              {statusGroups['inativo']?.map((entry) => (
                <div 
                  key={entry.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">{entry.customer_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {entry.notes || 'Sem observações'}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary">Inativo</Badge>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDateTime(entry.updated_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
