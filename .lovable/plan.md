

## Plano: Adicionar telefone e email nas exportações de Propostas e Sem Sucesso

### Problema
As exportações Excel das abas Propostas e Sem Sucesso não incluem telefone e email do contato, apesar dos dados estarem disponíveis nos hooks (`contact_phone`, `contact_email`).

### Alterações em `src/pages/crm/PosReuniao.tsx`

**Aba Propostas (linha ~343)**
- Adicionar campos `"Telefone": p.contact_phone || ''` e `"Email": p.contact_email || ''` no mapeamento de exportação

**Aba Sem Sucesso (linha ~466)**
- Adicionar campo `"Email": d.contact_email || ''` no mapeamento de exportação (telefone ja existe)

### Resultado
Ambas exportações incluirão: Contato, Telefone, Email + campos específicos de cada aba.

