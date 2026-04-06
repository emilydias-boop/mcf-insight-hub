import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Database, Calendar } from 'lucide-react';
import { useCloserContractsList } from '@/hooks/useCloserContractsList';
import { formatDate } from '@/lib/formatters';

interface CloserContractsListProps {
  sdrId: string;
  anoMes: string;
}

export const CloserContractsList = ({ sdrId, anoMes }: CloserContractsListProps) => {
  const { data: contracts, isLoading } = useCloserContractsList(sdrId, anoMes);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-lg">Contratos Pagos</CardTitle>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <Database className="h-3 w-3" />
            Fonte: Agenda
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Carregando...</div>
        ) : !contracts || contracts.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            Nenhum contrato pago neste mês.
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>SDR</TableHead>
                  <TableHead>Data Reunião</TableHead>
                  <TableHead>Data Contrato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">{contract.leadName}</TableCell>
                    <TableCell>{contract.sdrName || '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {contract.meetingDate ? formatDate(contract.meetingDate) : '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {formatDate(contract.contractPaidAt)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="pt-3 border-t mt-3 flex items-center justify-between">
              <span className="font-medium">Total de Contratos</span>
              <span className="font-bold text-lg">{contracts.length}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
