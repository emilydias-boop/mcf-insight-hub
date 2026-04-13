import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatBRL = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '—';

const formatPct = (v: number | null | undefined) =>
  v != null ? `${v.toFixed(0)}%` : '—';

interface PayoutDetails {
  aprovado_por_nome?: string;
  aprovado_em?: string | null;
  valor_fixo?: number | null;
  valor_variavel_total?: number | null;
  total_conta?: number | null;
  total_ifood?: number | null;
  ifood_mensal?: number | null;
  ifood_ultrameta?: number | null;
  pct_reunioes_agendadas?: number | null;
  valor_reunioes_agendadas?: number | null;
  pct_reunioes_realizadas?: number | null;
  valor_reunioes_realizadas?: number | null;
  pct_tentativas?: number | null;
  valor_tentativas?: number | null;
  pct_organizacao?: number | null;
  valor_organizacao?: number | null;
  pct_no_show?: number | null;
  valor_no_show?: number | null;
}

interface NfseEmailParams {
  employeeName: string;
  monthLabel: string;
  numeroNfse: string;
  valorNfse: string;
  dataEnvio: string;
  pdfUrl?: string;
  payout?: PayoutDetails;
}

function row(label: string, value: string) {
  return `<tr><td style="padding:6px 12px;color:#666;font-size:13px;">${label}</td><td style="padding:6px 12px;font-weight:600;font-size:13px;text-align:right;">${value}</td></tr>`;
}

function sectionHeader(title: string) {
  return `<tr><td colspan="2" style="padding:12px 12px 6px;font-weight:700;font-size:14px;color:#1a1a2e;border-top:1px solid #e5e5e5;">${title}</td></tr>`;
}

export function buildNfseDetailedEmailHtml(params: NfseEmailParams): string {
  const { employeeName, monthLabel, numeroNfse, valorNfse, dataEnvio, pdfUrl, payout } = params;

  const subject = `NFSe Fechamento — ${employeeName} — ${monthLabel}`;

  let payoutSection = '';
  if (payout) {
    const aprovadoEm = payout.aprovado_em
      ? format(new Date(payout.aprovado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
      : '—';

    const kpiRows = [
      { label: 'Reuniões Agendadas', pct: payout.pct_reunioes_agendadas, val: payout.valor_reunioes_agendadas },
      { label: 'Reuniões Realizadas', pct: payout.pct_reunioes_realizadas, val: payout.valor_reunioes_realizadas },
      { label: 'Tentativas', pct: payout.pct_tentativas, val: payout.valor_tentativas },
      { label: 'Organização', pct: payout.pct_organizacao, val: payout.valor_organizacao },
      { label: 'No-Show', pct: payout.pct_no_show, val: payout.valor_no_show },
    ].filter(k => k.val != null && k.val !== 0);

    const kpiHtml = kpiRows.map(k =>
      row(`&nbsp;&nbsp;• ${k.label} (${formatPct(k.pct)})`, formatBRL(k.val))
    ).join('');

    payoutSection = `
      ${sectionHeader('APROVAÇÃO')}
      ${row('Aprovado por', payout.aprovado_por_nome || '—')}
      ${row('Data aprovação', aprovadoEm)}
      ${sectionHeader('COMPOSIÇÃO DO VALOR')}
      ${row('Fixo', formatBRL(payout.valor_fixo))}
      ${row('Variável', formatBRL(payout.valor_variavel_total))}
      ${kpiHtml}
      ${(payout.total_ifood != null && payout.total_ifood > 0) ? row('iFood', formatBRL(payout.total_ifood)) : ''}
      ${row('<strong>Total Conta</strong>', `<strong>${formatBRL(payout.total_conta)}</strong>`)}
    `;
  }

  const pdfButton = pdfUrl
    ? `<tr><td colspan="2" style="padding:12px;text-align:center;">
        <a href="${pdfUrl}" style="background:#1a1a2e;color:#fff;padding:10px 24px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:13px;">
          📄 Baixar NFSe (PDF)
        </a>
       </td></tr>`
    : '';

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:#1a1a2e;padding:24px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:18px;">MCF - Minha Casa Financiada</h1>
      </div>
      <div style="padding:24px;">
        <h2 style="color:#1a1a2e;margin:0 0 16px;font-size:16px;">${subject}</h2>
        <table style="width:100%;border-collapse:collapse;background:#f9f9fb;border-radius:8px;">
          ${sectionHeader('DADOS DA NOTA')}
          ${row('Data de envio', dataEnvio)}
          ${row('Número NFSe', numeroNfse || 'Não informado')}
          ${row('Valor', `R$ ${valorNfse}`)}
          ${pdfButton}
          ${payoutSection}
        </table>
      </div>
      <div style="background:#f5f5f5;padding:16px 24px;text-align:center;font-size:12px;color:#888;">
        Este é um email automático. Por favor, não responda.
      </div>
    </div>
  `;
}
