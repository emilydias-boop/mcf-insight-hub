

# Adicionar Filtros Avancados na Tabela de Reunioes

## Problema
A tabela de reunioes do SDR so tem filtros de status e tipo. O usuario precisa:
- Filtrar por **data da reuniao** (ex: ver so as de hoje, ou de amanha)
- **Buscar por nome** do lead
- Ver rapidamente o que foi **agendado para um dia especifico**

## Solucao

Adicionar 2 novos filtros ao componente `SdrLeadsTable`:

### 1. Filtro por data da reuniao (DatePicker)
- Seletor de data unica que filtra pelo campo `scheduled_at`
- Quando selecionado, mostra apenas reunioes daquele dia
- Botao "Hoje" como atalho rapido ao lado

### 2. Busca por nome do lead (Input texto)
- Campo de busca que filtra por `contact_name` e `contact_email` (case-insensitive)
- Com icone de lupa e placeholder "Buscar lead..."

### Layout dos filtros
```text
[🔍 Buscar lead...] [📅 Data reuniao] [Hoje] [Status ▼] [Tipo ▼] [Limpar]  20 de 20 leads
```

### Logica de filtragem
- Filtro de data compara `scheduled_at` com `startOfDay`/`endOfDay` da data selecionada
- Busca por nome usa `.toLowerCase().includes()`
- Todos os filtros se acumulam (AND)
- "Limpar filtros" reseta tudo

### Arquivo
| Arquivo | Acao |
|---------|------|
| `src/components/sdr/SdrLeadsTable.tsx` | Adicionar input de busca, date picker e botao "Hoje" |

