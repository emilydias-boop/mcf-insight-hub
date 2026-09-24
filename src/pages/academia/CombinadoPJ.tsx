const ITENS = [
  ["Contrato", "Prestação de serviços com a VMX Participações, por prazo indeterminado, aviso prévio de 30 dias e assinatura eletrônica em duas etapas."],
  ["Nota fiscal", "Emitida pela sua PJ contra a VMX."],
  ["Pagamento", "Fixo até o dia 10 do mês seguinte. Variável apurado de 1 a 30 e pago até o dia 20, via PIX, mediante NF."],
  ["Deduções", "Cancelamentos, reembolsos e chargebacks são deduzidos."],
  ["Benefício", "Cartão iFood de R$ 30,00 por dia útil, quando previsto (cláusula 5.5)."],
  ["Reembolso de despesas", "Somente com aprovação prévia."],
  ["Confidencialidade e não-competição", "Por 12 meses (cláusulas 7ª e 8ª)."],
];

export default function CombinadoPJ() {
  return (
    <div className="max-w-3xl space-y-4">
      <div><div className="ac-eyebrow">Página de referência</div><h1 className="text-3xl">Combinado PJ</h1>
        <p className="text-muted-foreground mt-1">Resumo do que está no seu contrato. Em caso de dúvida, vale o documento assinado.</p></div>
      {ITENS.map(([t, d]) => <div key={t} className="ac-card p-5"><div className="ac-eyebrow mb-1">{t}</div><p>{d}</p></div>)}
    </div>
  );
}
