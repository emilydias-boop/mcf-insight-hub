
# Correção: Acesso às Configurações + Dados 2026 no Calendário de Dias Úteis

## Problemas Identificados

### 1. Navegação Inacessível
A página de Configurações (`/fechamento-sdr/configuracoes`) só é acessível via URL direta. Não há botão ou link na página principal do Fechamento SDR que leve para as configurações.

### 2. Dados Faltando para 2026
A tabela `working_days_calendar` só contém dados de Janeiro 2025 até Dezembro 2025. Como estamos em Janeiro 2026, não há dados disponíveis para o ano atual.

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/fechamento-sdr/Index.tsx` | Adicionar botão de Configurações no header |
| `src/components/sdr-fechamento/WorkingDaysCalendar.tsx` | Adicionar botão "Gerar Ano" e lógica de criação automática |

---

## Detalhes Técnicos

### 1. Adicionar Link para Configurações

No arquivo `Index.tsx`, adicionar um botão Settings ao lado dos outros botões (Recalcular, Exportar):

```typescript
import { Settings } from 'lucide-react';
// ...

<Button
  variant="outline"
  onClick={() => navigate('/fechamento-sdr/configuracoes')}
>
  <Settings className="h-4 w-4 mr-2" />
  Configurações
</Button>
```

### 2. Adicionar Geração Automática de Anos

No `WorkingDaysCalendar.tsx`, adicionar:

1. **Botão "Adicionar Ano"** no header do card
2. **Função para gerar dados** usando a lógica existente em `businessDays.ts`
3. **Verificação de anos faltantes** para mostrar alerta

```typescript
import { getDiasUteisMes } from '@/lib/businessDays';

// Função para gerar meses de um ano
const generateYearData = async (year: number) => {
  const months = [];
  for (let month = 0; month < 12; month++) {
    const date = new Date(year, month, 1);
    const anoMes = format(date, 'yyyy-MM');
    const diasUteis = getDiasUteisMes(date);
    
    months.push({
      ano_mes: anoMes,
      dias_uteis_base: diasUteis,
      dias_uteis_final: diasUteis,
      ifood_valor_dia: 30, // Valor padrão
      observacoes: format(date, "MMMM yyyy", { locale: ptBR }),
    });
  }
  
  // Insert via upsert para não duplicar
  const { error } = await supabase
    .from('working_days_calendar')
    .upsert(months, { onConflict: 'ano_mes' });
  
  if (error) throw error;
};

// UI
<CardHeader>
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <Calendar className="h-5 w-5 text-primary" />
      <CardTitle>Calendário de Dias Úteis</CardTitle>
    </div>
    <Button onClick={() => addYearMutation.mutate(2026)}>
      <Plus className="h-4 w-4 mr-2" />
      Adicionar 2026
    </Button>
  </div>
</CardHeader>
```

### 3. Detectar Anos Faltantes

Adicionar verificação automática para mostrar alerta quando o ano atual não existe:

```typescript
const currentYear = new Date().getFullYear();
const hasCurrentYear = workingDays?.some(wd => wd.ano_mes.startsWith(String(currentYear)));

{!hasCurrentYear && (
  <Alert variant="warning">
    <AlertTriangle className="h-4 w-4" />
    <AlertDescription>
      O calendário não possui dados para {currentYear}. 
      <Button variant="link" onClick={() => addYearMutation.mutate(currentYear)}>
        Clique aqui para adicionar
      </Button>
    </AlertDescription>
  </Alert>
)}
```

---

## Fluxo Visual

```
┌─────────────────────────────────────────────────────────────────┐
│ Fechamento SDR                                                  │
│                                                                 │
│ [Mês ▼]  [Recalcular]  [Exportar CSV]  [⚙ Configurações]  ← NOVO│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────┐
│ Configurações de Fechamento SDR                                 │
│                                                                 │
│ [SDRs] [Planos OTE] [📅 Dias Úteis]                             │
│                                                                 │
│ ⚠️ O calendário não possui dados para 2026. [Adicionar 2026]   │
│                                                                 │
│ 📅 Calendário de Dias Úteis                    [+ Adicionar Ano]│
│ ┌───────────────┬──────────┬──────────┬───────────────────────┐ │
│ │ Mês           │ Dias Base│ Dias Fim │ Observações           │ │
│ ├───────────────┼──────────┼──────────┼───────────────────────┤ │
│ │ Janeiro 2026  │ 22       │ 22       │ Janeiro 2026          │ │
│ │ Fevereiro 2026│ 20       │ 18       │ Fevereiro 2026 - Carn.│ │
│ │ ...           │ ...      │ ...      │ ...                   │ │
│ └───────────────┴──────────┴──────────┴───────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Cálculo Automático de Dias Úteis

A função `getDiasUteisMes()` já existe em `businessDays.ts` e calcula automaticamente:
- Dias sem fins de semana
- Desconta feriados fixos (Ano Novo, Tiradentes, etc.)
- Desconta feriados móveis (Carnaval, Páscoa, Corpus Christi)

Isso permite gerar os 12 meses de um ano com valores corretos automaticamente.

---

## Resultado Esperado

| Situação | Antes | Depois |
|----------|-------|--------|
| Acesso às Configurações | Só via URL direta | Botão no header da página |
| Dados 2026 | Não existem | Gerados automaticamente ou via botão |
| Anos futuros | Manual via SQL | Botão "Adicionar Ano" |

---

## Sequência de Implementação

1. Adicionar import de `Settings` e botão de navegação em `Index.tsx`
2. Adicionar lógica de geração de ano no `WorkingDaysCalendar.tsx`
3. Adicionar alerta quando ano atual está faltando
4. Adicionar mutation para inserir dados do ano
5. Testar navegação e geração de dados
