import { BUReportCenter } from '@/components/relatorios/BUReportCenter';
import { RoleGuard } from '@/components/auth/RoleGuard';

export default function ProjetosRelatorios() {
  return (
    <RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}>
      <BUReportCenter 
        bu="projetos" 
        availableReports={['sales', 'performance']} 
      />
    </RoleGuard>
  );
}
