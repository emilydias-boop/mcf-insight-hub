import * as XLSX from 'xlsx';
import { ExamScore, Exam } from '@/hooks/useExams';

export function exportExamScores(exam: Exam, scores: ExamScore[]) {
  const rows = scores.map((s, i) => ({
    'Posição': i + 1,
    'Colaborador': s.employee?.nome_completo || 'N/A',
    'Cargo': s.employee?.cargo || '-',
    'Squad': s.employee?.squad || '-',
    'Nota': Number(s.nota),
    'Observação': s.observacao || '',
    'Data': new Date(s.created_at).toLocaleDateString('pt-BR'),
  }));

  rows.sort((a, b) => b.Nota - a.Nota);
  rows.forEach((r, i) => (r['Posição'] = i + 1));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Resultados');

  const colWidths = [8, 30, 20, 20, 8, 30, 12];
  ws['!cols'] = colWidths.map(w => ({ wch: w }));

  XLSX.writeFile(wb, `prova_${exam.titulo.replace(/\s+/g, '_')}.xlsx`);
}
