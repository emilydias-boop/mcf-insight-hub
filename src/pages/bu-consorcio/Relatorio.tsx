import { BUReportCenter } from '@/components/relatorios/BUReportCenter';
import { RoleGuard } from '@/components/auth/RoleGuard';

export default function ConsorcioRelatorios() {
  return (
    <RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}>
      <BUReportCenter 
        bu="consorcio" 
        availableReports={['contracts', 'sales', 'performance', 'acquisition']} 
      />
    </RoleGuard>
  );
}
