import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileText } from 'lucide-react';
import { ReportTypeSelector, ReportType } from './ReportTypeSelector';
import { ContractReportPanel } from './ContractReportPanel';
import { SalesReportPanel } from './SalesReportPanel';
import { PerformanceReportPanel } from './PerformanceReportPanel';
import { AcquisitionReportPanel } from './AcquisitionReportPanel';
import { BusinessUnit } from '@/hooks/useMyBU';
import { useAuth } from '@/contexts/AuthContext';

// BU display names
const BU_NAMES: Record<BusinessUnit, string> = {
  incorporador: 'BU - Incorporador MCF',
  consorcio: 'BU - Consórcio',
  credito: 'BU - Crédito',
  projetos: 'BU - Projetos',
  leilao: 'BU - Leilão',
  marketing: 'BU - Marketing',
};

interface BUReportCenterProps {
  bu: BusinessUnit;
  availableReports?: ReportType[];
}

export function BUReportCenter({ 
  bu, 
  availableReports = ['contracts', 'sales', 'performance'] 
}: BUReportCenterProps) {
  const { role } = useAuth();
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  
  const buName = BU_NAMES[bu];
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Relatórios - {buName}</h1>
          <p className="text-muted-foreground">
            Gere relatórios personalizados da sua equipe
            {role === 'coordenador' && ' (apenas sua equipe)'}
          </p>
        </div>
      </div>
      
      {/* Report Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Central de Relatórios</CardTitle>
          <CardDescription>
            Escolha o tipo de relatório que deseja gerar e configure os filtros
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReportTypeSelector
            selected={selectedReport}
            onSelect={setSelectedReport}
            availableReports={availableReports}
          />
        </CardContent>
      </Card>
      
      {/* Selected Report Panel */}
      {selectedReport === 'contracts' && (
        <ContractReportPanel bu={bu} />
      )}
      
      {selectedReport === 'sales' && (
        <SalesReportPanel bu={bu} />
      )}
      
      {selectedReport === 'performance' && (
        <PerformanceReportPanel bu={bu} />
      )}
      
      {selectedReport === 'acquisition' && (
        <AcquisitionReportPanel bu={bu} />
      )}
      
      {/* Empty State */}
      {!selectedReport && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Selecione um tipo de relatório acima para começar</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
