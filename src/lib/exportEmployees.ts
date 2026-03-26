import * as XLSX from 'xlsx';
import type { Employee } from '@/types/hr';
import { format } from 'date-fns';

export function exportEmployeesToXlsx(employees: Employee[]) {
  const rows = employees.map(e => ({
    'Nome Completo': e.nome_completo,
    CPF: e.cpf || '',
    Cargo: e.cargo || '',
    Departamento: e.departamento || '',
    Squad: e.squad || '',
    Vínculo: e.tipo_contrato || '',
    Status: e.status,
    'Data Admissão': e.data_admissao ? format(new Date(e.data_admissao), 'dd/MM/yyyy') : '',
    'Data Demissão': e.data_demissao ? format(new Date(e.data_demissao), 'dd/MM/yyyy') : '',
    'Salário Base': e.salario_base,
    Email: e.email_pessoal || '',
    Telefone: e.telefone || '',
    Cidade: e.cidade || '',
    Estado: e.estado || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Colaboradores');
  XLSX.writeFile(wb, `colaboradores_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}
