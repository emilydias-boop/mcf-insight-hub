import { BUReportCenter } from '@/components/relatorios/BUReportCenter';
import { RoleGuard } from '@/components/auth/RoleGuard';

export default function CreditoRelatorios() {
  return (
    <RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}>
      <BUReportCenter 
        bu="credito" 
        availableReports={['sales', 'performance']} 
      />
    </RoleGuard>
  );
}
