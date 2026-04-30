---
name: Agenda R1 channel classification
description: Regra simplificada de canal usada APENAS na Agenda R1 (lista) — A010 / ANAMNESE / Outro
type: feature
---
Na Agenda R1 (`/crm/agenda`, aba Lista) a coluna **Canal** e o filtro de Canal usam classificação SIMPLIFICADA, diferente do `classifyChannel` genérico usado em relatórios:

- **A010**: o lead consta como comprador em `a010_sales` (match por `customer_email` em lower/trim OU pelos últimos 9 dígitos de `customer_phone`).
- **ANAMNESE**: o deal possui tag exatamente igual a `ANAMNESE`, `ANAMNESE-INSTA` ou `ANAMNESE INSTA` (case-insensitive, trim). Tags em formato `{...json...}` são parseadas para extrair `name`.
- **Outro**: qualquer outro caso (não confundir com os rótulos genéricos WEBHOOK/HUBLA/BASE CLINT/LEAD-FORM do `classifyChannel`).

Implementação: `src/components/crm/MeetingsList.tsx` (função `classifySimple` + lookup em `a010_sales`) e `src/pages/crm/Agenda.tsx` (export Excel reproduz a mesma regra).

Não usar `classifyChannel` aqui — ele é mais granular e estava poluindo a tela com canais técnicos.
