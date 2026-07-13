export function buildConsorcioBoasVindasEmail(params: { nomeCliente: string }): { subject: string; htmlContent: string } {
  const nome = (params.nomeCliente || 'Cliente').trim();
  const subject = 'Parabéns pela sua nova Carta de Consórcio! Conheça seu time de acompanhamento';

  const contatoBloco = (nome: string, wa: string, waLabel: string, email: string) => `
    <div style="border:1px solid #e5e5e5; border-radius:8px; padding:16px; margin:12px 0; background:#fafafa;">
      <p style="margin:0 0 6px; font-weight:bold; color:#1a1a2e; font-size:15px;">${nome}</p>
      <p style="margin:0 0 4px; color:#333; font-size:14px;">WhatsApp: <a href="https://wa.me/${wa}" style="color:#1a1a2e; text-decoration:none;">${waLabel}</a></p>
      <p style="margin:0; color:#333; font-size:14px;">E-mail: <a href="mailto:${email}" style="color:#1a1a2e; text-decoration:none;">${email}</a></p>
    </div>
  `;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff;">
      <div style="background: #1a1a2e; padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px;">MCF - Minha Casa Financiada</h1>
      </div>
      <div style="padding: 32px 24px; color:#333; font-size:15px; line-height:1.6;">
        <h2 style="color:#1a1a2e; margin:0 0 16px; font-size:19px;">Parabéns pela sua nova Carta de Consórcio!</h2>
        <p>Olá, <strong>${nome}</strong>!</p>
        <p>É com grande satisfação que confirmamos oficialmente a aquisição da sua Carta de Consórcio, negociada na reunião com nossa equipe de Alavancagem Patrimonial.</p>
        <p><strong>Parabéns pela decisão!</strong> A partir de agora, você não estará sozinho nessa jornada.</p>

        <h3 style="color:#1a1a2e; margin:24px 0 8px; font-size:16px;">Conheça seu time de acompanhamento</h3>
        <p>A partir deste momento, <strong>Emily</strong> e <strong>Antony</strong> serão os responsáveis por cuidar da sua carta de consórcio de ponta a ponta. Eles vão:</p>
        <ul style="padding-left:20px; margin:8px 0;">
          <li>Acompanhar todo o andamento da sua carta;</li>
          <li>Enviar lembretes para o pagamento das parcelas, para que você nunca perca uma data importante;</li>
          <li>Avisar sobre sorteios e assembleias;</li>
          <li>Orientar estrategicamente após a contemplação da sua carta;</li>
          <li>Gerenciar o acelerador de contemplações, buscando antecipar sua contemplação sempre que possível;</li>
          <li>Acompanhar estrategicamente os próximos passos após a contemplação;</li>
          <li>Tirar suas dúvidas e te ajudar sempre que precisar.</li>
        </ul>

        <p>Em breve, Emily e Antony vão entrar em contato com você através do WhatsApp para se apresentarem pessoalmente e alinharem os próximos passos.</p>
        <p>Para que você já tenha os contatos à mão, seguem abaixo:</p>

        ${contatoBloco('Emily', '5511940652061', '+55 11 94065-2061', 'emily.dias@minhacasafinanciada.com')}
        ${contatoBloco('Antony', '5511940284344', '+55 11 94028-4344', 'antony.nicolas@minhacasafinanciada.com')}

        <p style="margin-top:20px;">Qualquer dúvida, pode contar com eles — e com toda a nossa equipe — sempre que precisar.</p>
      </div>
      <div style="background:#f5f5f5; padding:16px 24px; text-align:center; font-size:12px; color:#888;">
        Este é um email automático. Por favor, não responda.
      </div>
    </div>
  `;

  return { subject, htmlContent };
}