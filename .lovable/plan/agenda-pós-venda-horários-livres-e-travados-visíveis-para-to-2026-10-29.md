# Agenda Pós-Venda: horários livres e travados visíveis para todos com acesso

## O que acontece hoje (confirmado)
- Os horários livres da Rebeca só aparecem na aba **"Por Gerente"**. A aba **Calendário**, que abre primeiro, mostra só as reuniões marcadas. Por isso você não viu os horários.
- Fora da faixa 14h30–17h não aparece nenhum aviso de "travado". O horário fica só em branco.
- Hoje só administradores e gerentes de relacionamento conseguem ler os horários configurados. Quem acessa o pipeline/agenda por outro caminho (por exemplo, permissão individual de pipeline) não vê os horários.
- A versão nova ainda não foi publicada. O site mcfgestao.com continua com a versão antiga.

## O que vou fazer
1. **Calendário (dia e semana):** mostrar os horários livres de cada gerente como botões clicáveis que abrem "Nova reunião" já preenchida. Os horários fora da faixa configurada, ou já passados, aparecem em cinza como "Indisponível".
2. **Aba Por Gerente:** fazer o mesmo, marcando em cinza os horários travados.
3. **Quem pode ver:** liberar a leitura dos horários para todo usuário com acesso ao pipeline/agenda Pós-Venda, ou seja, administradores, gerentes de relacionamento e quem tem o pipeline Pós-Venda liberado no perfil (como a Karen). Só administradores continuam podendo alterar os horários.
4. Gerentes sem horários configurados (William, Vitor, Kalyanne) continuam sem trava, como hoje.
5. Depois disso, publicar para a mudança chegar ao site.

## Detalhes técnicos
- Ajustar `pos_venda_tem_acesso()` (usada pela política de leitura de `pos_venda_disponibilidade`) para incluir usuários cujo `allowed_origin_ids` contém `POS_VENDA_ORIGIN_ID`. Antes, confirmo onde essa permissão fica gravada. A validação de agendamento no banco não muda.
- Em `AgendaPosVenda.tsx`, passar `livres` e a faixa configurada para as colunas do `GradeHorarios` também na aba Calendário, e renderizar como bloqueados os horários do gerente configurado que estão fora de `pos_venda_disponibilidade`.
- Atualizar o teste de `posVendaDisponibilidade` para a regra de horário travado.
