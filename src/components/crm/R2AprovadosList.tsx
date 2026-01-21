import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Copy, Check, ShoppingCart, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { R2CarrinhoAttendee, useUpdateCarrinhoStatus } from '@/hooks/useR2CarrinhoData';
import { toast } from 'sonner';

interface R2AprovadosListProps {
  attendees: R2CarrinhoAttendee[];
  isLoading?: boolean;
  weekEnd: Date;
}

export function R2AprovadosList({ attendees, isLoading, weekEnd }: R2AprovadosListProps) {
  const [copied, setCopied] = useState(false);
  const updateStatus = useUpdateCarrinhoStatus();

  const handleSetStatus = (attendeeId: string, status: 'vai_comprar' | 'comprou' | 'nao_comprou' | null) => {
    updateStatus.mutate({ attendeeId, status });
  };

  const generateReport = () => {
    const dateStr = format(weekEnd, 'dd/MM', { locale: ptBR });
    let report = `*Carrinho ${dateStr}*\n\n`;
    report += `APROVADOS\t${attendees.length}\n\n`;

    attendees.forEach((att, idx) => {
      const name = att.attendee_name || att.deal_name || 'Sem nome';
      const phone = att.attendee_phone || att.contact_phone || '-';
      const closer = att.closer_name || '-';
      let suffix = '';
      
      if (att.carrinho_status === 'vai_comprar') {
        suffix = ' - VAI COMPRAR';
      } else if (att.carrinho_status === 'comprou') {
        suffix = ' - ✅ COMPROU';
      }

      report += `${idx + 1} ${name}\t${phone}\t*Aprovado*\t${closer}${suffix}\n`;
    });

    return report;
  };

  const handleCopyReport = async () => {
    const report = generateReport();
    await navigator.clipboard.writeText(report);
    setCopied(true);
    toast.success('Relatório copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportExcel = () => {
    const headers = ['#', 'Nome', 'Telefone', 'Status', 'Closer', 'Carrinho'];
    const rows = attendees.map((att, idx) => [
      idx + 1,
      att.attendee_name || att.deal_name || 'Sem nome',
      att.attendee_phone || att.contact_phone || '-',
      'Aprovado',
      att.closer_name || '-',
      att.carrinho_status === 'vai_comprar' ? 'Vai Comprar' :
      att.carrinho_status === 'comprou' ? 'Comprou' :
      att.carrinho_status === 'nao_comprou' ? 'Não Comprou' : '-',
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `carrinho-aprovados-${format(weekEnd, 'dd-MM-yyyy')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Arquivo exportado!');
  };

  if (isLoading) {
    return <div className="flex justify-center py-8">Carregando...</div>;
  }

  if (attendees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <ShoppingCart className="h-12 w-12 mb-4 opacity-50" />
        <p>Nenhum aprovado na semana</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {attendees.length} aprovados
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyReport}>
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? 'Copiado!' : 'Copiar Relatório'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Closer</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attendees.map((att, idx) => (
              <TableRow key={att.id} className={att.carrinho_status === 'comprou' ? 'bg-green-50 dark:bg-green-950/20' : ''}>
                <TableCell className="font-medium">{idx + 1}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{att.attendee_name || att.deal_name || 'Sem nome'}</span>
                    {att.partner_name && (
                      <span className="text-xs text-muted-foreground">+ {att.partner_name}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {att.attendee_phone || att.contact_phone || '-'}
                </TableCell>
                <TableCell>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                    Aprovado
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {att.closer_color && (
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: att.closer_color }}
                      />
                    )}
                    {att.closer_name || '-'}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={att.carrinho_status === 'vai_comprar' ? 'default' : 'ghost'}
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => handleSetStatus(
                            att.id, 
                            att.carrinho_status === 'vai_comprar' ? null : 'vai_comprar'
                          )}
                        >
                          <ShoppingCart className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Vai Comprar</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={att.carrinho_status === 'comprou' ? 'default' : 'ghost'}
                          size="sm"
                          className={`h-8 px-2 ${att.carrinho_status === 'comprou' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                          onClick={() => handleSetStatus(
                            att.id, 
                            att.carrinho_status === 'comprou' ? null : 'comprou'
                          )}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Comprou</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={att.carrinho_status === 'nao_comprou' ? 'destructive' : 'ghost'}
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => handleSetStatus(
                            att.id, 
                            att.carrinho_status === 'nao_comprou' ? null : 'nao_comprou'
                          )}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Não Comprou</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
