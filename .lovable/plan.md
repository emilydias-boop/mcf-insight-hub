

# Adaptar Agenda do Closer de Consorcio: "R1 Realizada" ao inves de "Contrato Pago"

## Contexto

No Consorcio, closers nao vendem "contrato pago". Uma reuniao realizada pode gerar uma proposta enviada/fechada. O painel de busca e o filtro de status na agenda mostram "Contrato Pago", o que nao se aplica a esta BU.

## Mudancas

### 1. `src/components/crm/MeetingSearchPanel.tsx`

Adicionar prop opcional `isConsorcio?: boolean` para adaptar o comportamento:

- **Texto placeholder**: Trocar "Busque leads para marcar como 'Contrato Pago'" por "Busque reunioes realizadas para follow-up"
- **Botao de acao**: Quando `isConsorcio`, esconder o botao de "Marcar Contrato Pago" (icone $), pois nao faz sentido. Mostrar apenas o botao de "Ver detalhes" (chevron).
- **Badge "Pago"**: Quando `isConsorcio`, nao mostrar o badge "Pago" - mostrar o status normal do attendee.

### 2. `src/pages/crm/Agenda.tsx`

- Passar `isConsorcio={activeBU === 'consorcio'}` para o `MeetingSearchPanel`
- No filtro de status (Select), quando `activeBU === 'consorcio'`, esconder a opcao "Contrato Pago" pois nao se aplica

### 3. `src/hooks/useSearchPastMeetings.ts`

Nenhuma mudanca necessaria - o hook ja busca reunioes com status `completed` e `no_show`, que e exatamente o que precisamos para o Consorcio.

## Resultado visual

No painel "Buscar Reunioes Passadas" para closers de Consorcio:
- Texto: "Busque reunioes realizadas para follow-up"
- Resultados mostram nome, data, telefone e status (Realizada/No-show)
- Apenas botao de "Ver detalhes" (sem botao $)
- Filtro de status sem opcao "Contrato Pago"

