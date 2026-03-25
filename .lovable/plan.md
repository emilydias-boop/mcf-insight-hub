

## Melhorias no Controle Diego: UX do Kanban + Drawer Rico

### Problemas identificados
1. **Drag & Drop**: O click no card abre o drawer ao invés de permitir arrastar — o drag handle (ícone de grip) é pequeno demais e confuso
2. **Drawer pobre**: Faltam informações importantes como data da R1, data de compra A010, SDR que agendou, jornada do lead
3. **Cards com poucas informações**: Não mostram dados como data da R1, SDR

### Solução

**1. Corrigir UX do Kanban (ControleDiegoPanel.tsx)**
- Remover o `onClick` do card inteiro — o click só abre drawer via um botão/área específica (ex: nome do lead clicável)
- O card inteiro fica arrastável (sem precisar do grip handle pequeno)
- Adicionar mais info nos cards: SDR, data da R1 (meetingDate)
- Adicionar botão "Marcar como enviado" direto no card da coluna Pendentes (sem precisar arrastar)

**2. Enriquecer o Drawer (ControleDiegoDrawer.tsx)**
- Usar `useLeadJourney(dealId)` para buscar jornada completa (SDR, R1, R2)
- Usar `useA010Journey(email, phone)` para dados de compra A010
- Mostrar seções:
  - **Dados do contrato**: Closer, SDR (nome resolvido), data pagamento, pipeline, canal
  - **Jornada do Lead**: Entrada pipeline, R1 (data, closer, status), R2 (se houver)
  - **A010**: Data da compra, valor pago, produto
  - **Contato**: Email, telefone, WhatsApp
  - **Controle de vídeo**: Toggle + observação (já existe)
- O drawer precisa receber `dealId` para buscar a jornada

**3. Atualizar KanbanRow para incluir meetingDate e dealId**
- `meetingDate` (data da R1) já vem do `useContractReport` — expor no card
- `dealId` já está no KanbanRow — passar ao drawer

### Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `ControleDiegoPanel.tsx` | Refatorar cards: drag no card inteiro, click no nome abre drawer, botão "enviar" no card, mostrar SDR e data R1 |
| `ControleDiegoDrawer.tsx` | Adicionar `useLeadJourney` e `useA010Journey`, mostrar jornada completa, receber `dealId` |

### Card do Kanban (novo layout)

```text
┌────────────────────────────────┐
│ André Meireles Gomes ← clicável (abre drawer)
│ Closer: Thayna · SDR: Alex Dias
│ R1: 20/03 · Pgto: 25/03 · A010
│ 📱 21981541133    [✓ Enviar]
└────────────────────────────────┘
```
Todo o card é arrastável. Nome abre drawer. Telefone abre WhatsApp. Botão marca como enviado.

