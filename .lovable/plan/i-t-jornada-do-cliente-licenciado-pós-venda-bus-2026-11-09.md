# I.T. — Jornada do Cliente Licenciado (Pós-venda → BUs)

Um PDF de Instrução de Trabalho no mesmo visual do documento de referência: faixa preta no topo com "MCF CAPITAL", destaques em verde-limão, títulos em barras pretas ("PARTE N"), caixas de destaque e rodapé numerado. Nenhuma tela ou dado do sistema é alterado.

## Estrutura do documento
1. **Capa** — logo MCF CAPITAL (o projeto não tem arquivo de logo e a referência usa o nome escrito; vou desenhar o logo como texto no mesmo estilo, e troco pelo oficial se você enviar a imagem), título "Instrução de Trabalho — Jornada do Cliente Licenciado", código IT, versão 1.0, data de emissão 09/11/2026 e responsável: Thobson Motta.
2. **Sumário** com número de página de cada parte.
3. **Controle do documento** — objetivo, alcance (Pós-venda, Gerentes de Relacionamento, Consórcio, War Room e Crédito), papéis, termos usados (Novos Licenciados, HARVEY, Trilha, Jornada, GR) e histórico de versões.
4. **Visão geral do fluxo** — diagrama das etapas, da entrada do cliente até o encaminhamento para outra BU.
5. **Etapa 1 — Admissão (Karen, Pós-venda)** — o cliente entra sozinho em "Novos Licenciados" quando a compra é registrada. A Karen confere o cartão e registra a nota de contato. Sem essa nota, o cartão não sai da etapa.
6. **Etapa 2 — Contato de boas-vindas (telefone/WhatsApp)** — roteiro: explicar a jornada, enviar o link de cadastro no HARVEY (https://mcfcapital.com.br) e confirmar que o cadastro foi feito.
7. **Etapa 3 — Agendamento com o Gerente de Relacionamento** — passo a passo na Agenda de Reuniões do Pós-venda: escolher o gerente, o dia e um horário livre, e o convite vai por e-mail. Inclui como reagendar e como cancelar.
8. **Etapa 4 — Reunião de Viabilidade (GR)** — conduzir a reunião, criar o produto e a viabilidade, e mostrar a trilha (https://trilha.mcfcapital.com.br). Ensinar o cliente a consultar a própria etapa em https://trilha.mcfcapital.com.br/jornada com o CPF dele ou do comprador.
9. **Etapa 5 — Encaminhamento para Consórcio, War Room ou Crédito** — pela opção "Agendar em outra BU", na reunião ou no menu "⋯" do cartão. O cartão do Pós-venda ganha a etiqueta "Encaminhado: …" e a reunião é marcada na agenda da BU escolhida.
10. **Pontos de controle e erros comuns** — tabela com o que conferir em cada etapa, quem faz e o que fazer quando der errado.
11. **Checklist final** de uma página, para imprimir.

## Detalhes técnicos
- Feito em Python/ReportLab, com fonte DejaVu (acentos corretos), A4, cabeçalho e rodapé em todas as páginas, a partir da 2ª, com "pág. X de Y".
- Salvo em `/mnt/documents/IT_Jornada_Cliente_Licenciado_MCF.pdf`.
- Antes de entregar, converto cada página em imagem e confiro sobreposições, cortes e quebras.
- O conteúdo vem do pedido e do que existe hoje no sistema: a regra da nota de contato, a agenda dos gerentes, o reagendamento e a opção "Agendar em outra BU".
