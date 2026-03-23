import { BUReportCenter } from '@/components/relatorios/BUReportCenter';

export default function CreditoRelatorios() {
  return (
    <BUReportCenter 
      bu="credito" 
      availableReports={['sales', 'performance']} 
    />
  );
}
