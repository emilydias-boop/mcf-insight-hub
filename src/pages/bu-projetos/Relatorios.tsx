import { BUReportCenter } from '@/components/relatorios/BUReportCenter';

export default function ProjetosRelatorios() {
  return (
    <BUReportCenter 
      bu="projetos" 
      availableReports={['sales', 'performance']} 
    />
  );
}
