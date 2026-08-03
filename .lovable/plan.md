# Coluna "SDR" na view Lista da Agenda dos Closers

## Onde fica essa tela

- Página: `src/pages/crm/Agenda.tsx` (título "Agenda dos Closers" / "Minha Agenda", tabs Calendário / Por Closer / Lista, contadores A010 / ANAMNESE / PLANILHA / OUTROS / Total e os filtros de closer/status/canal).
- Tabela da aba "Lista": `src/components/crm/MeetingsList.tsx` (colunas Data/Hora, Lead, Canal, Closer, Status, Ações). Cada linha é um attendee, não um slot.
- Dados: `useAgendaMeetings` em `src/hooks/useAgendaData.ts`.

## BU

Tela compartilhada: a rota é por BU (`/{bu}/crm/agenda`) e a página usa `useActiveBU()` para filtrar closers e semana. A mesma tela serve Incorporador e Consórcio — a coluna SDR apareceria nas duas.

## O dado do SDR já está disponível?

Sim, na maior parte dos casos, sem join novo:

- `meeting_slots.booked_by` e `meeting_slot_attendees.booked_by` já vêm na query.
- O hook já busca os perfis desses IDs em `profiles` e anexa `booked_by_profile` (`full_name`, `email`) tanto no slot quanto em cada attendee.
- `MeetingsList` simplesmente não usa esse campo hoje — ele não é copiado para `AttendeeRow`.

Único ponto que exige ajuste de query: o fallback por dono do negócio. `crm_deals.owner_id` (que guarda o e-mail do responsável) **não** está no `select` do deal na query da agenda. Para ter esse fallback quando `booked_by` é nulo, é preciso incluir `owner_id` no select do deal (slot e attendee) e resolver o nome pelo e-mail em `profiles`.

## Implementação proposta

1. `useAgendaData.ts`: adicionar `owner_id` ao select de `deal` (slot e attendee) e, na etapa que já monta o mapa de perfis, resolver também os e-mails de `owner_id` para nome (uma query extra em `profiles` por `email`), expondo algo como `owner_profile`.
2. `MeetingsList.tsx`:
   - novo campo `sdrName` em `AttendeeRow`, com hierarquia: `attendee.booked_by_profile` > `meeting.booked_by_profile` > nome do dono do deal (`owner_id`) > "—";
   - nova coluna "SDR" no header e no body, entre "Canal" e "Closer";
   - opcionalmente incluir o nome do SDR na busca por texto.

## Dúvidas

- A hierarquia de atribuição (booked_by do attendee > booked_by do slot > owner do deal) é a desejada, alinhada ao padrão de atribuição de SDR dos relatórios?
- Quer também um filtro "Todos os SDRs" no topo, ou só a coluna por enquanto?