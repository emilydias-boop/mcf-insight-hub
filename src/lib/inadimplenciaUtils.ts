import { ConsorcioInstallment } from '@/types/consorcio';

export interface InadimplenciaInfo {
  parcelasAtrasadas: number;
  risco: 'baixo' | 'medio' | 'alto' | 'cancelamento';
  mensagem: string;
  cor: string;
  corBadge: string;
}

/**
 * A 1ª parcela é a ENTRADA: vence na própria data do cadastro e é paga no ato.
 * Por isso ela só entra na conta de atraso depois de uma carência de 5 dias —
 * sem isso a cota nascia exibindo "1 parcela em atraso" no dia da criação.
 */
const CARENCIA_ENTRADA_DIAS = 5;

export function contarParcelasAtrasadas(installments: ConsorcioInstallment[]): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return installments.filter(inst => {
    if (inst.status === 'pago') return false;

    const dataVencimento = new Date(inst.data_vencimento);
    dataVencimento.setHours(0, 0, 0, 0);

    if (inst.numero_parcela === 1) {
      const limite = new Date(dataVencimento);
      limite.setDate(limite.getDate() + CARENCIA_ENTRADA_DIAS);
      return limite < hoje;
    }

    return dataVencimento < hoje;
  }).length;
}


export function verificarRiscoCancelamento(installments: ConsorcioInstallment[]): InadimplenciaInfo {
  const parcelasAtrasadas = contarParcelasAtrasadas(installments);
  
  if (parcelasAtrasadas === 0) {
    return {
      parcelasAtrasadas: 0,
      risco: 'baixo',
      mensagem: 'Pagamentos em dia',
      cor: 'text-green-600',
      corBadge: 'bg-green-100 text-green-800',
    };
  }
  
  if (parcelasAtrasadas <= 2) {
    return {
      parcelasAtrasadas,
      risco: 'medio',
      mensagem: `${parcelasAtrasadas} parcela${parcelasAtrasadas > 1 ? 's' : ''} em atraso`,
      cor: 'text-yellow-600',
      corBadge: 'bg-yellow-100 text-yellow-800',
    };
  }
  
  if (parcelasAtrasadas === 3) {
    return {
      parcelasAtrasadas,
      risco: 'alto',
      mensagem: 'ALERTA: 3 parcelas em atraso - Próximo de cancelamento!',
      cor: 'text-red-600',
      corBadge: 'bg-red-100 text-red-800',
    };
  }
  
  return {
    parcelasAtrasadas,
    risco: 'cancelamento',
    mensagem: `CRÍTICO: ${parcelasAtrasadas} parcelas em atraso - Cota deve ser cancelada!`,
    cor: 'text-red-700',
    corBadge: 'bg-red-200 text-red-900',
  };
}

export function deveSerCancelado(installments: ConsorcioInstallment[]): boolean {
  return contarParcelasAtrasadas(installments) >= 4;
}
