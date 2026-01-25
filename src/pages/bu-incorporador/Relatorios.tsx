import { BUReportCenter } from '@/components/relatorios/BUReportCenter';
import { RoleGuard } from '@/components/auth/RoleGuard';

export default function IncorporadorRelatorios() {
  return (
    <RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}>
      <BUReportCenter 
        bu="incorporador" 
        availableReports={['contracts', 'sales', 'performance']} 
      />
    </RoleGuard>
  );
}
