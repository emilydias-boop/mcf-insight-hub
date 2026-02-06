import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGRAuditLog } from '@/hooks/useGRDetailMetrics';
import { formatDateTime } from '@/lib/formatters';
import { ClipboardList, ArrowRightLeft, User, Loader2 } from 'lucide-react';

interface GRAuditTabProps {
  walletId: string;
}

export const GRAuditTab = ({ walletId }: GRAuditTabProps) => {
  const { data: auditLogs = [], isLoading } = useGRAuditLog(walletId);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  
  // Filter by type - distribution is derived from transfers to this wallet
  const transfers = auditLogs.filter(log => log.type === 'transfer');
  const statusChanges = auditLogs.filter(log => log.type === 'status_change');
  const distributions = transfers.filter(log => log.description?.includes('recebido'));
  
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <ArrowRightLeft className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Transferências</p>
              <p className="text-2xl font-bold">{transfers.length}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <ClipboardList className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Mudanças de Status</p>
              <p className="text-2xl font-bold">{statusChanges.length}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <User className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Distribuições</p>
              <p className="text-2xl font-bold">{distributions.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Log de Auditoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum registro de auditoria
            </p>
          ) : (
            <div className="space-y-4">
              {auditLogs.map((log) => (
                <div 
                  key={log.id}
                  className="flex items-start gap-4 p-4 rounded-lg border bg-card"
                >
                  <div className={`p-2 rounded-lg ${
                    log.type === 'transfer' 
                      ? 'bg-purple-500/10' 
                      : log.type === 'status_change'
                        ? 'bg-blue-500/10'
                        : 'bg-emerald-500/10'
                  }`}>
                    {log.type === 'transfer' ? (
                      <ArrowRightLeft className={`h-4 w-4 ${
                        log.type === 'transfer' ? 'text-purple-500' : 'text-blue-500'
                      }`} />
                    ) : log.type === 'status_change' ? (
                      <ClipboardList className="h-4 w-4 text-blue-500" />
                    ) : (
                      <User className="h-4 w-4 text-emerald-500" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{log.description}</p>
                      <Badge variant="outline" className="text-xs">
                        {log.type === 'transfer' ? 'Transferência' 
                          : log.type === 'status_change' ? 'Status' 
                          : 'Distribuição'}
                      </Badge>
                    </div>
                    
                    {log.details && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {log.details}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Por: {log.performed_by_name || 'Sistema'}</span>
                      <span>{formatDateTime(log.created_at)}</span>
                    </div>
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
