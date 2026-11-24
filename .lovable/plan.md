# Requisições de contratação: Fase 5 pendente e atores repetidos

## Etapa 1 — Ficou alguma fase pendente?
Sim. O plano original tinha 6 fases. Verifiquei o banco e as telas:

- Fases 1 a 4 entregues: estrutura e alçadas, requisição de contratação, dossiê e desligamento.
- **Fase 5 (assinatura digital interna) nunca foi construída.** Não existe tabela de assinaturas, nem tela "Minhas aprovações", nem botões Aprovar, Reprovar ou Devolver. Por isso a requisição fica "Em aprovação" e congelada, com o aviso na tela. Desligamentos têm o mesmo aviso.
- Fase 6 (auditoria completa, indicadores do RH) também ficou em aberto.

A Fase 5 é grande: assinatura com aval do Google (como está registrado), fluxo em ordem, prazos, lembretes e página de verificação em PDF. Proponho fazê-la em um plano separado, depois de corrigir a Etapa 2.

## Etapa 2 — Atores previstos repetidos
A requisição de SDR (BU Incorporador 50K) tem 9 atores, e 6 deles são "Diretoria". Causa confirmada no banco:

- Há 6 regras de alçada de contratação ("Contratar Inside", "Contratar Consórcio", "Contratar Crédito", "Pós-venda/Relacionamento", "Marketing" e "Delisgar Consórcio"). Nenhuma tem o **setor da condição** preenchido, então todas valem para qualquer requisição.
- 5 delas apontam para o mesmo setor aprovador, por isso a mesma pessoa aparece 5 vezes.
- "Delisgar Consórcio" está marcada como regra de **contratação**. Pelo nome, deveria ser de desligamento.
- A mesma pessoa também aparece como Solicitante e Responsável do setor.

### Correção
1. **Remover repetições:** cada pessoa aparece uma vez só na lista de atores, com os papéis juntos (ex.: "Solicitante · Responsável do setor · Diretoria"). Isso vale para novas requisições e desligamentos.
2. **Tela:** a lista de atores mostra as repetições já agrupadas, inclusive nas requisições antigas, sem mudar o que ficou gravado.
3. **Regras de alçada:** em RH › Configurações › Governança, cada regra ganha o setor a que se aplica (Inside → setor Inside, Consórcio → Consórcio etc.), e "Delisgar Consórcio" passa a valer para desligamento. Eu faço esse ajuste depois que você confirmar o setor de cada regra.
4. **Requisição de SDR já enviada:** está congelada. Recalculo os atores dela só se você autorizar.

## Detalhes técnicos
- Regras: `gov_alcadas` com `cond_departamento_id` nulo em todas as linhas; a requisição `1c91465a…` tem 9 itens em `atores_previstos`.
- Juntar por `employee_id` (ou `role` quando não houver pessoa) na função que monta os atores na hora do envio (gov_private), mantendo a ordem do primeiro aparecimento e `alcada_ids` como lista.
- Front: `src/pages/rh/Requisicoes.tsx` (e Desligamentos) agrupa por pessoa ao exibir.
- Recalcular a requisição congelada exige liberar o gatilho de congelamento só para essa linha. Feito apenas se autorizado.
