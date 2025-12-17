import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PagamentoFilters, PagamentoPJ, PagamentosSummary } from '@/types/financeiro';
import { Employee, RhNfse } from '@/types/hr';

export const useFinanceiroPagamentos = (filters: PagamentoFilters) => {
  const { mes, ano, squad, cargo, statusNfse, statusPagamento } = filters;

  return useQuery({
    queryKey: ['financeiro-pagamentos', mes, ano, squad, cargo, statusNfse, statusPagamento],
    queryFn: async () => {
      // Fetch PJ employees
      let employeesQuery = supabase
        .from('employees')
        .select('*')
        .eq('tipo_contrato', 'PJ')
        .eq('status', 'ativo');

      if (squad) {
        employeesQuery = employeesQuery.eq('squad', squad);
      }
      if (cargo) {
        employeesQuery = employeesQuery.eq('cargo', cargo);
      }

      const { data: employees, error: empError } = await employeesQuery;
      if (empError) throw empError;

      // Fetch fechamentos for the period
      const anoMes = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const { data: fechamentos, error: fechError } = await supabase
        .from('sdr_month_payout')
        .select('*')
        .eq('ano_mes', anoMes)
        .in('status', ['approved', 'locked']);

      if (fechError) throw fechError;

      // Fetch NFSe for the period
      const { data: nfseList, error: nfseError } = await supabase
        .from('rh_nfse')
        .select('*')
        .eq('mes', mes)
        .eq('ano', ano);

      if (nfseError) throw nfseError;

      // Build pagamentos list
      const pagamentos: PagamentoPJ[] = (employees || []).map((emp: Employee) => {
        // Find fechamento via sdr_id
        const fechamento = fechamentos?.find((f: any) => f.sdr_id === emp.sdr_id) || null;
        const nfse = (nfseList as RhNfse[] | null)?.find((n) => n.employee_id === emp.id) || null;
        
        const valorFechamento = fechamento?.total_conta || 0;
        const valorNfse = nfse?.valor_nfse || 0;
        const diferenca = nfse ? valorNfse - valorFechamento : null;

        return {
          employee: emp as Employee,
          fechamento: fechamento ? {
            id: fechamento.id,
            ano_mes: fechamento.ano_mes,
            total_conta: fechamento.total_conta || 0,
            status: fechamento.status,
          } : null,
          nfse: nfse as RhNfse | null,
          diferenca,
        };
      });

      // Apply status filters
      let filtered = pagamentos;
      if (statusNfse && statusNfse !== 'todos') {
        filtered = filtered.filter((p) => {
          if (statusNfse === 'pendente_envio') return !p.nfse;
          if (statusNfse === 'nota_enviada') return !!p.nfse;
          return true;
        });
      }
      if (statusPagamento && statusPagamento !== 'todos') {
        filtered = filtered.filter((p) => {
          const status = p.nfse?.status_pagamento || 'pendente';
          return status === statusPagamento;
        });
      }

      // Calculate summary
      const summary: PagamentosSummary = {
        totalAPagar: pagamentos.reduce((sum, p) => sum + (p.fechamento?.total_conta || 0), 0),
        nfseEnviadas: pagamentos.filter((p) => p.nfse).length,
        totalFechamentos: pagamentos.filter((p) => p.fechamento).length,
        totalPago: pagamentos
          .filter((p) => p.nfse?.status_pagamento === 'pago')
          .reduce((sum, p) => sum + (p.nfse?.valor_nfse || 0), 0),
        pendente: pagamentos
          .filter((p) => !p.nfse || p.nfse.status_pagamento !== 'pago')
          .reduce((sum, p) => sum + (p.nfse?.valor_nfse || p.fechamento?.total_conta || 0), 0),
      };

      return { pagamentos: filtered, summary };
    },
  });
};

export const useMarkAsPaid = () => {
  const markAsPaid = async (data: {
    employeeId: string;
    mes: number;
    ano: number;
    valorNfse: number;
    dataPagamento: string;
    existingNfseId?: string;
  }) => {
    if (data.existingNfseId) {
      // Update existing NFSe
      const { error } = await supabase
        .from('rh_nfse')
        .update({
          status_pagamento: 'pago',
          data_pagamento: data.dataPagamento,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.existingNfseId);

      if (error) throw error;
    } else {
      // Create new NFSe record
      const { error } = await supabase.from('rh_nfse').insert({
        employee_id: data.employeeId,
        mes: data.mes,
        ano: data.ano,
        valor_nfse: data.valorNfse,
        status_nfse: 'pendente_envio',
        status_pagamento: 'pago',
        data_pagamento: data.dataPagamento,
      });

      if (error) throw error;
    }
  };

  return { markAsPaid };
};

export const useUpdateNfse = () => {
  const updateNfse = async (nfseId: string, data: Partial<RhNfse>) => {
    const { error } = await supabase
      .from('rh_nfse')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', nfseId);

    if (error) throw error;
  };

  const createNfse = async (data: Omit<RhNfse, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => {
    const { error } = await supabase.from('rh_nfse').insert(data);
    if (error) throw error;
  };

  return { updateNfse, createNfse };
};
