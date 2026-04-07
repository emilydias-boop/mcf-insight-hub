import { useState } from 'react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConsorcioPagamentosTab } from '@/components/consorcio/pagamentos/ConsorcioPagamentosTab';
import { BoletoUploadDialog } from '@/components/consorcio/pagamentos/BoletoUploadDialog';
import { BoletoReviewDialog } from '@/components/consorcio/pagamentos/BoletoReviewDialog';
import { useBoletosReview } from '@/hooks/useConsorcioBoletos';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const date = subMonths(new Date(), i);
  return {
    value: String(i),
    label: format(date, 'MMMM yyyy', { locale: ptBR }),
    start: startOfMonth(date),
    end: endOfMonth(date),
  };
});

export default function ConsorcioPagamentosPage() {
  const [monthOffset, setMonthOffset] = useState<string>('0');
  const [reviewOpen, setReviewOpen] = useState(false);
  const selectedMonth = MONTH_OPTIONS[Number(monthOffset)] || MONTH_OPTIONS[0];
  const { data: reviewBoletos = [] } = useBoletosReview();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">💳 Pagamentos Consórcio</h1>
          <p className="text-muted-foreground">
            Controle de parcelas e boletos das cartas de consórcio
          </p>
        </div>
        <div className="flex items-center gap-3">
          <BoletoUploadDialog />
          {reviewBoletos.length > 0 && (
            <Button variant="outline" className="border-amber-500 text-amber-600 hover:bg-amber-50" onClick={() => setReviewOpen(true)}>
              <AlertTriangle className="h-4 w-4 mr-1" />
              Revisar Boletos
              <Badge variant="destructive" className="ml-1.5 text-xs">{reviewBoletos.length}</Badge>
            </Button>
          )}
          <Select value={monthOffset} onValueChange={setMonthOffset}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ConsorcioPagamentosTab
        selectedMonth={{
          start: format(selectedMonth.start, 'yyyy-MM-dd'),
          end: format(selectedMonth.end, 'yyyy-MM-dd'),
        }}
      />
    </div>
  );
}
