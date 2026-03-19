

## Plano: Corrigir 404 na rota `/crm/auditoria-agendamentos`

### Problema

A rota `auditoria-agendamentos` não foi adicionada ao grupo de rotas `/crm` em `App.tsx` (linhas 363-386). Ela existe nos layouts de BU (consórcio, incorporador, etc.) mas falta no CRM principal.

### Correção

| Arquivo | Ação |
|---------|------|
| `src/App.tsx` | Adicionar `<Route path="auditoria-agendamentos" element={<AuditoriaAgendamentos />} />` dentro do grupo `<Route path="crm">`, após a linha 382 (retornos-parceiros) |

Uma linha de código resolve o 404.

