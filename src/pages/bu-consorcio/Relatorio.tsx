import { BUReportCenter } from '@/components/relatorios/BUReportCenter';

export default function ConsorcioRelatorios() {
  return (
    <BUReportCenter 
      bu="consorcio" 
      availableReports={['contracts', 'sales', 'performance', 'acquisition', 'products', 'cross_bu']} 
    />
  );
}
