

## Plano: Botao "Copiar Relatório" na aba Pendentes do R2

### Alteração em `src/components/crm/R2PendingLeadsPanel.tsx`

Adicionar um botão "Copiar Relatório" ao lado do badge de pendentes (linha ~98-119) que, ao clicar, copia para a área de transferência um texto formatado com as informações de cada lead pendente (filtrado pelo closer selecionado):

**Formato do texto copiado:**
```text
📋 RELATÓRIO PENDENTES R2 - DD/MM/YYYY
Total: X leads

1. Nome: Mariane Souza
   📞 Telefone: 17 99231-1238
   📅 R1: 05/03 às 15:30
   👤 Closer R1: Mateus Macedo
   💰 Contrato Pago: 05/03 às 15:50

2. Nome: matheus soares augusto
   ...
```

**Implementação:**
- Adicionar botão com ícone `Copy` do lucide-react na barra de ações (ao lado do filtro de Closer R1)
- Usar `navigator.clipboard.writeText()` para copiar
- Feedback via `sonner` toast ("Relatório copiado!")
- Iterar sobre `filteredLeads` para montar o texto com: `attendee_name`, `attendee_phone`, `meeting_slot.scheduled_at`, `meeting_slot.closer.name`, `contract_paid_at`

