

## Plano: Botão "Copiar Relatório" na aba No-Shows do R2

### Alteração em `src/components/crm/R2NoShowsPanel.tsx`

Adicionar botão "Copiar Relatório" ao lado do contador de resultados (linha ~441), com a mesma lógica do painel de Pendentes, adaptado aos dados de no-show.

**Formato do relatório:**
```text
📋 RELATÓRIO NO-SHOWS R2 - DD/MM/YYYY
Total: X no-shows

1. Nome: Fábio Raposo Monaco
   📞 Telefone: 11 99472-8877
   📧 Email: frmonaco@hotmail.com
   📅 R2 era: 06/03 às 16:00
   👤 Sócio R2: Claudia Carielo
   📞 SDR: Yanca Tavares
   🎯 Closer R1: Julio (02/03)
```

**Implementação:**
- Importar `Copy` do lucide-react e `toast` do sonner
- Adicionar `useCallback` ao import do React
- Criar `handleCopyReport` iterando sobre `filteredLeads` com os campos: `name`, `phone`, `email`, `scheduled_at`, `closer_name`, `sdr_name`, `r1_closer_name`, `r1_date`
- Botão outline com ícone `Copy` posicionado antes do contador "Mostrando X no-shows"

