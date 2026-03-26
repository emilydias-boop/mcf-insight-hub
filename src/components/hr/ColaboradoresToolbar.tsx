import { Button } from '@/components/ui/button';
import { Plus, Download, Network, MessageSquare, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Employee } from '@/types/hr';
import { exportEmployeesToXlsx } from '@/lib/exportEmployees';

interface Props {
  onNewEmployee: () => void;
  filteredEmployees: Employee[];
}

export default function ColaboradoresToolbar({ onNewEmployee, filteredEmployees }: Props) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={onNewEmployee}>
        <Plus className="h-4 w-4 mr-2" />
        Novo Colaborador
      </Button>
      <Button variant="outline" onClick={() => exportEmployeesToXlsx(filteredEmployees)}>
        <Download className="h-4 w-4 mr-2" />
        Exportar Base
      </Button>
      <Button variant="outline" onClick={() => navigate('/rh/configuracoes')}>
        <Network className="h-4 w-4 mr-2" />
        Organograma
      </Button>
    </div>
  );
}
