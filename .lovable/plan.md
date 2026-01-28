
# Ajustar Layout "R2 Agendadas" - Tabela por Dia da Reunião

## Objetivo
Reorganizar a aba "R2 Agendadas" do Carrinho R2 para exibir uma **tabela** organizada por dia da reunião R2, com colunas específicas conforme o status do attendee.

## Layout Proposto

### Estrutura Visual

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ Segunda, 26 de Janeiro                                                              [11]│
├─────────┬─────────────────────────┬──────────────┬──────────────┬───────────────────────┤
│ Horário │ Nome Lead               │ Closer R2    │ Dia R1       │ Status / Info         │
├─────────┼─────────────────────────┼──────────────┼──────────────┼───────────────────────┤
│ 08:00   │ João Silva              │ Claudia      │ 20/01        │ Contrato Pago (21/01) │
│ 09:00   │ Maria Santos            │ Thob         │ 19/01        │ [Agendada]            │
│ 10:00   │ Pedro Oliveira          │ Julio        │ 21/01        │ [No-show]             │
│ 11:00   │ Ana Costa               │ Claudia      │ 20/01        │ [Realizada] ✓ Aprov   │
└─────────┴─────────────────────────┴──────────────┴──────────────┴───────────────────────┘
```

### Colunas da Tabela

| Coluna | Descrição |
|--------|-----------|
| **Horário** | Hora da R2 (HH:mm) |
| **Nome Lead** | Nome do attendee ou do deal |
| **Closer R2** | Nome do closer responsável pela R2 |
| **Dia R1** | Data da reunião R1 original (formato DD/MM) |
| **Status/Info** | Varia conforme o status (ver abaixo) |

### Lógica da Última Coluna

Para **Contrato Pago**:
```
"Contrato Pago (DD/MM)" + badge "Aprovado" se r2_status_name contiver "aprovado"
```

Para **Agendada/Realizada/No-show**:
```
Badge colorido com o status + "✓ Aprovado" se aplicável
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useR2CarrinhoData.ts` | Adicionar campos `r1_date` e `contract_paid_at` |
| `src/components/crm/R2AgendadasList.tsx` | Substituir layout por tabela agrupada por dia |

---

## Detalhes Técnicos

### 1. Atualizar Hook `useR2CarrinhoData`

Adicionar busca de informações da R1 (similar ao `useR2NoShowLeads`):

```typescript
// Interface atualizada
export interface R2CarrinhoAttendee {
  // ... campos existentes ...
  r1_date: string | null;        // NOVO: Data da R1
  contract_paid_at: string | null; // NOVO: Quando foi pago
}

// Na query, adicionar contract_paid_at ao select de attendees
attendees:meeting_slot_attendees(
  id, attendee_name, attendee_phone, status, r2_status_id,
  carrinho_status, carrinho_updated_at, deal_id, partner_name,
  contract_paid_at,  // NOVO
  deal:crm_deals(...)
)

// Após a query principal, buscar R1 meetings
const dealIds = new Set(attendees.filter(a => a.deal_id).map(a => a.deal_id));

const { data: r1Meetings } = await supabase
  .from('meeting_slots')
  .select(`scheduled_at, meeting_slot_attendees!inner(deal_id)`)
  .eq('meeting_type', 'r1')
  .in('meeting_slot_attendees.deal_id', Array.from(dealIds));

// Criar mapa deal_id -> r1_date
const r1Map = new Map<string, string>();
r1Meetings?.forEach(r1 => {
  r1.meeting_slot_attendees.forEach(att => {
    if (att.deal_id && !r1Map.has(att.deal_id)) {
      r1Map.set(att.deal_id, r1.scheduled_at);
    }
  });
});

// Incluir no retorno
attendees.push({
  ...att,
  r1_date: att.deal_id ? r1Map.get(att.deal_id) : null,
  contract_paid_at: att.contract_paid_at,
});
```

### 2. Reescrever `R2AgendadasList.tsx`

```typescript
// Estrutura da tabela
<div className="space-y-4">
  {sortedDays.map((day) => (
    <Card key={day}>
      <CardHeader className="py-3 px-4 bg-muted/50">
        {/* Header do dia */}
        <span className="font-semibold capitalize">
          {format(new Date(day), "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </span>
        <Badge>{dayAttendees.length}</Badge>
      </CardHeader>
      
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Horário</TableHead>
              <TableHead>Nome Lead</TableHead>
              <TableHead>Closer R2</TableHead>
              <TableHead className="w-[90px]">Dia R1</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAttendees.map((att) => (
              <TableRow key={att.id} onClick={...}>
                <TableCell className="font-mono font-medium">
                  {format(new Date(att.scheduled_at), 'HH:mm')}
                </TableCell>
                <TableCell>{att.attendee_name || att.deal_name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{bg: att.closer_color}} />
                    {att.closer_name}
                  </div>
                </TableCell>
                <TableCell>
                  {att.r1_date ? format(new Date(att.r1_date), 'dd/MM') : '-'}
                </TableCell>
                <TableCell className="text-right">
                  {renderStatusCell(att)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  ))}
</div>

// Função para renderizar última coluna
function renderStatusCell(att: R2CarrinhoAttendee) {
  if (att.status === 'contract_paid' || att.meeting_status === 'contract_paid') {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className="text-emerald-600 text-sm">
          CP {att.contract_paid_at ? format(new Date(att.contract_paid_at), 'dd/MM') : ''}
        </span>
        {att.r2_status_name?.toLowerCase().includes('aprovado') && (
          <Badge className="bg-emerald-500">Aprovado</Badge>
        )}
      </div>
    );
  }
  
  // Para outros status
  return (
    <div className="flex items-center justify-end gap-2">
      <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
      {att.r2_status_name?.toLowerCase().includes('aprovado') && (
        <span className="text-emerald-500">✓</span>
      )}
    </div>
  );
}
```

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Cards verticais com info empilhada | Tabela horizontal com colunas claras |
| Closer + Status na linha 2 | Tudo em colunas alinhadas |
| Sem data da R1 | Coluna "Dia R1" mostrando quando foi a R1 |
| Sem data do contrato pago | Mostra "CP DD/MM" quando aplicável |

---

## Sequência de Implementação

1. Atualizar interface `R2CarrinhoAttendee` com novos campos
2. Modificar query no `useR2CarrinhoData` para buscar R1 date e contract_paid_at
3. Reescrever `R2AgendadasList.tsx` com layout de tabela
4. Testar visualização na aba "R2 Agendadas"
