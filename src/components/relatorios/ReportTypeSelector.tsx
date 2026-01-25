import { Card, CardContent } from '@/components/ui/card';
import { FileText, DollarSign, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ReportType = 'contracts' | 'sales' | 'performance';

interface ReportTypeOption {
  id: ReportType;
  title: string;
  description: string;
  icon: React.ElementType;
}

const reportOptions: ReportTypeOption[] = [
  {
    id: 'contracts',
    title: 'Contratos',
    description: 'Contratos pagos por closer',
    icon: FileText,
  },
  {
    id: 'sales',
    title: 'Vendas',
    description: 'Transações e faturamento',
    icon: DollarSign,
  },
  {
    id: 'performance',
    title: 'Desempenho',
    description: 'Performance SDRs/Closers',
    icon: BarChart3,
  },
];

interface ReportTypeSelectorProps {
  selected: ReportType | null;
  onSelect: (type: ReportType) => void;
  availableReports?: ReportType[];
}

export function ReportTypeSelector({ 
  selected, 
  onSelect,
  availableReports = ['contracts', 'sales', 'performance'],
}: ReportTypeSelectorProps) {
  const filteredOptions = reportOptions.filter(opt => availableReports.includes(opt.id));

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-muted-foreground">Selecione o tipo de relatório:</label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {filteredOptions.map((option) => {
          const isSelected = selected === option.id;
          const Icon = option.icon;
          
          return (
            <Card
              key={option.id}
              className={cn(
                'cursor-pointer transition-all hover:border-primary/50',
                isSelected && 'border-primary ring-2 ring-primary/20 bg-primary/5'
              )}
              onClick={() => onSelect(option.id)}
            >
              <CardContent className="pt-6 text-center">
                <div className={cn(
                  'mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3',
                  isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold">{option.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
