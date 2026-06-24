import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Download, Network, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Employee } from '@/types/hr';
import { exportEmployeesToXlsx } from '@/lib/exportEmployees';

interface Props {
  onNewEmployee: () => void;
  filteredEmployees: Employee[];
}

export default function ColaboradoresToolbar({ onNewEmployee, filteredEmployees }: Props) {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportEmployeesToXlsx(filteredEmployees);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={onNewEmployee}>
        <Plus className="h-4 w-4 mr-2" />
        Novo Colaborador
      </Button>
      <Button variant="outline" onClick={handleExport} disabled={exporting}>
        {exporting ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        {exporting ? 'Gerando...' : 'Exportar Base'}
      </Button>
      <Button variant="outline" onClick={() => navigate('/rh/configuracoes')}>
        <Network className="h-4 w-4 mr-2" />
        Organograma
      </Button>
    </div>
  );
}
