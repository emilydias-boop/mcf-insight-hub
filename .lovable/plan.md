

## Plano: Botão "Copiar Leads" por estágio no Kanban

### Problema
O usuário precisa copiar rapidamente nome e telefone de todos os leads de um estágio do Kanban para fazer disparos de mensagens.

### Solução
Adicionar um botão de "Copiar" no header de cada coluna do Kanban que copia nome e telefone de todos os leads daquele estágio para a área de transferência, formatado para disparo.

### Alterações

**1. `src/components/crm/DealKanbanBoard.tsx`**
- Adicionar um botão `Copy` (ícone de clipboard) no header de cada coluna, ao lado do badge de contagem
- Ao clicar, percorre todos os `stageDeals` daquela coluna, extrai `deal.crm_contacts?.name` e `deal.crm_contacts?.phone`, e copia para o clipboard
- Formato copiado: uma linha por lead com `Nome - Telefone` (ex: `João Silva - 11999998888`)
- Leads sem telefone serão incluídos com indicação `(sem telefone)`
- Exibir toast confirmando quantos leads foram copiados

### Formato da cópia

```text
Cláudia Monique Costa Valente - 11999991234
Thiago de Oliveira Pereira - 21988887777
Daniel Marinho Alves - (sem telefone)
```

### Detalhes técnicos
- Os dados de contato (`name`, `phone`) já estão disponíveis via join `crm_contacts` no query `useCRMDeals`
- Acessível via `deal.crm_contacts?.phone` e `deal.crm_contacts?.name`
- Usar `navigator.clipboard.writeText()` para copiar
- O botão ficará visível sempre (não depende do modo de seleção)
- Import do ícone `ClipboardCopy` do lucide-react

