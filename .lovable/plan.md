# Importar carteira dos gerentes vinda do Harvey

## Destino já definido
- Pipeline: Relacionamento - Pós venda (BU Pós Venda).
- Todos os cards entram na 1ª etapa da pipeline. A coluna original do Harvey fica guardada no card como informação.

## O que vem nos arquivos
- 1.356 linhas de clientes, sendo 1.344 clientes distintos: há 12 repetidos, que viram um card só.
- 703 atividades e 731 encaminhamentos. O arquivo de reuniões está vazio.
- Colunas de origem: Novo (558), Agenda - Reunião de Produto (350), Boas Vindas (152), 1° Reunião (137), Primeiro Contato/Sem Reunião marcada (79 + 1), Acompanhamento (35), 2° Reunião (22), Em Andamento (15), Pediu/PEDINDO Reembolso (4), Produto Criado (2), Perdido (1).

## Etapas (cada uma só avança com a sua confirmação)
1. **Mapeamento de campos**: mostro a tabela campo do Harvey → campo daqui, com um exemplo real de cada, e espero você aprovar.
2. **Conferência dos gerentes**: para cada um dos 4 gerentes, mostro se o login foi encontrado e quantos clientes são esperados. Clientes de gerente sem login ficam de fora até você decidir.
3. **Prévia**: importo 1 cliente de cada gerente, de preferência um com atividades e encaminhamentos, e mostro o resultado.
4. **Importação completa**, em lotes:
   - Procuro o cliente primeiro por e-mail, depois por telefone e, por último, por CPF.
   - Se o cliente já existir, só preencho os campos vazios e acrescento o histórico.
   - Se der erro em uma linha, registro o erro e sigo para a próxima.
5. **Relatório final** por gerente: esperados, criados, atualizados e ignorados (com o motivo), além do total de atividades e encaminhamentos lançados.

## Regras de segurança
- Nada que já existe é apagado ou sobrescrito.
- Todos os registros importados recebem a etiqueta "Migrado do Harvey" (cor #C8FF00), a origem HARVEY_MCF e o código do cliente no Harvey.
- Importar os mesmos arquivos de novo não duplica nada, porque cada item é reconhecido pelo código que traz do Harvey.
- Entrar na pipeline não pode disparar mensagens, notificações para fora ou métricas de outras áreas. Antes da prévia, confiro as automações dessa pipeline e paro se alguma for disparar.

## Detalhes técnicos
- Contatos em `crm_contacts` e cards em `crm_deals` (origin_id = POS_VENDA_ORIGIN_ID, etapa inicial, owner_profile_id resolvido pelo e-mail do gerente). Os dados do Harvey ficam em custom_fields: origem, harvey_cliente_id, stage_harvey, prioridade, datas e notas.
- Histórico em `deal_activities` com created_at original e metadata.harvey_atividade_id / harvey_encaminhamento_id. A checagem de duplicidade é feita por esses ids.
- Importação feita por script com service_role em lotes de 100, gerando um log de erros.
- Nenhuma mudança de tela ou de código do app.
