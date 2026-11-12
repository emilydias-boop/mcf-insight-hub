# Erro ao agendar Bruno Esmeraldo (Rebeca)

## Causa (confirmada no banco)
- A Rebeca tem permissão de Pós-venda (perfil gerente de relacionamento) — o problema não é dela.
- O cliente **Bruno Esmeraldo - A010** não tem cartão no funil "Relacionamento - Pós venda". Ele só tem cartões em **PIPELINE INSIDE SALES** e **00 - GERENTES DE RELACIONAMENTO**.
- A regra do banco só deixa criar reunião de viabilidade para cartão do Pós-venda. Como a Rebeca abriu o cartão do funil "00 - Gerentes de Relacionamento", o banco recusou com a mensagem da imagem 2.
- É o mesmo caso do Oziel e da Ana Gabriela.

## O que fazer
1. Criar o cartão do Bruno em **Novos licenciados** no Pós-venda, com a compra dele (mesmo processo usado para Oziel/Ana Gabriela), mantendo a Rebeca como responsável.
2. No botão Agendar, quando o cartão não for do Pós-venda, trocar o erro técnico por uma mensagem clara: "Este cliente ainda não tem cartão no Pós-venda" e não abrir o formulário.
3. Pedir para a Rebeca agendar de novo a partir do cartão do Pós-venda (18/11 16:00, Viabilidade 1).

## Detalhes técnicos
- Política de insert em pos_venda_reunioes exige crm_deals.origin_id = POS_VENDA_ORIGIN_ID; deal usado: b501b3f2… (origem 016e7467…).
- Passo 2: checagem com isPosVendaDeal no QuickActionsBlock/NovaReuniaoPosVendaDialog antes do insert. Nenhuma regra de acesso é afrouxada.
