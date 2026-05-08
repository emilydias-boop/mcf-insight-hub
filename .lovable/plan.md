## Problema
A exportação atual da Agenda R2 (botão "Exportar Lista") só inclui 5 colunas: Nome, Telefone, Closer, Data/Hora e um Status simplificado (apenas Comparecimento). Faltam as colunas que aparecem na tela: Sócio, Perfil, Vídeo, Status Final (Aprovado/Carrinho etc.) e Termômetro.

## Solução
Atualizar `handleExportList` em `src/pages/crm/AgendaR2.tsx` para incluir todas as colunas exibidas na lista R2.

### Novas colunas no CSV exportado
1. **Hora** — `format(scheduled_at, 'dd/MM/yyyy HH:mm')`
2. **Lead** — nome do attendee/contato
3. **Telefone**
4. **Sócio** — `attendee.partner_name`
5. **Perfil** — `attendee.lead_profile` (label legível via `LEAD_PROFILE_OPTIONS`)
6. **Comparecimento** — status traduzido (Realizada / No-show / Agendada / Pré-agendado etc.)
7. **Closer** — `meeting.closer.name`
8. **Vídeo** — `attendee.video_status` (Ok / Pendente)
9. **Status Final** — `attendee.r2_status?.name` (Aprovado, Carrinho, etc.)
10. **Termômetro** — nomes dos `attendee.thermometers` separados por `; `

### Detalhes técnicos
- Manter formato CSV com BOM UTF-8 (já implementado).
- Usar os mesmos mapas de label já presentes no projeto (`ATTENDANCE_STATUS_OPTIONS`, `LEAD_PROFILE_OPTIONS`, `VIDEO_STATUS_OPTIONS`) para garantir os mesmos rótulos da UI; importar de onde `R2ListViewTable.tsx` os importa.
- Escapar aspas duplas dentro das células (`cell.replace(/"/g, '""')`).
- Não alterar a lógica de filtragem (`filteredMeetings`) — mantém o mesmo recorte que o usuário vê.