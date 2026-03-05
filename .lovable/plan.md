

## Plano: Transferir responsabilidades da Yanca para Leticia Rodrigues

### Situação atual
- **Yanca Oliveira**: ID `04bb4045-701d-443c-b2c9-aee74e7f58d9`
- **Leticia Rodrigues**: ID `6cb06155-26dd-4be9-87ce-53e60a59a4e7`
- **deal_tasks**: 0 tarefas atribuídas à Yanca (nenhuma necessidade de transferir)
- **meeting_slots**: 127 total (39 pendentes: 30 scheduled + 9 rescheduled)

### Alterações

**1. Banco de dados - Transferir meeting_slots pendentes**
- UPDATE `meeting_slots` SET `booked_by` = Leticia WHERE `booked_by` = Yanca AND `status` IN ('scheduled', 'rescheduled')
- Isso transfere os 39 agendamentos ativos para a Leticia

**2. Código - `src/constants/team.ts`**
- Substituir o ID e nome da Yanca por Leticia na `R2_BOOKERS_LIST` (ou remover Yanca se ela não faz mais parte da equipe)

**3. Código - `src/hooks/useAgendaData.ts`**
- Atualizar o comentário que menciona Yanca (linha ~1532) para referenciar Leticia

### Resultado
Leticia assumirá todos os agendamentos pendentes da Yanca e será a nova responsável por R2 bookings no sistema.

