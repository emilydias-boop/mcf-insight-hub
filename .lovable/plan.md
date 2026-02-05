

# Correção: iFood Ultrameta - Soma e Elegibilidade por Data de Admissão

## Regras de Negócio Identificadas

### 1. iFood Mensal vs iFood Ultrameta
- **iFood Mensal**: Pago no 1º dia do mês (baseado nos dias úteis trabalhados)
- **iFood Ultrameta**: Pago no dia 20 do mês (bônus adicional)
- **Ambos se SOMAM** (não substituem um ao outro)

### 2. Elegibilidade para iFood Ultrameta
O colaborador só recebe o iFood Ultrameta se:
- A ultrameta do time foi batida **E**
- O colaborador estava na equipe **desde o início do mês da meta**

**Critério de verificação:**
- Usar campo `employees.data_admissao`
- Se `data_admissao` é NULL ou anterior ao 1º dia do mês da meta → **elegível**
- Se `data_admissao` é durante o mês da meta → **não elegível**

Exemplo: Para meta de janeiro/2026, quem entrou em 15/01/2026 não recebe a ultrameta.

---

## Mudanças Necessárias

### 1. Edge Function `recalculate-sdr-payout`

**Modificação principal:**

```text
ANTES:
  ifood_ultrameta = teamGoal.ultrameta_premio_ifood (para todos)

DEPOIS:
  1. Buscar data_admissao do employee vinculado ao SDR
  2. Se data_admissao >= início do mês → ifood_ultrameta = 0
  3. Se data_admissao < início do mês (ou NULL) → ifood_ultrameta = teamGoal.ultrameta_premio_ifood
```

**Código a adicionar (dentro do loop de SDRs):**

```typescript
// Verificar elegibilidade para ultrameta (precisa estar desde o início do mês)
const { data: employeeData } = await supabase
  .from('employees')
  .select('data_admissao')
  .eq('sdr_id', sdr.id)
  .eq('status', 'ativo')
  .single();

const dataAdmissao = employeeData?.data_admissao 
  ? new Date(employeeData.data_admissao) 
  : null;

const inicioMes = new Date(year, month - 1, 1);

// Elegível se entrou antes do início do mês OU se data_admissao é null
const elegivelUltrameta = !dataAdmissao || dataAdmissao < inicioMes;

if (teamUltrametaHit && teamGoal && elegivelUltrameta) {
  ifoodUltrameta = teamGoal.ultrameta_premio_ifood;
  console.log(`   🎁 Ultrameta liberada para ${sdr.name}`);
} else if (teamUltrametaHit && teamGoal && !elegivelUltrameta) {
  ifoodUltrameta = 0;
  console.log(`   ⏭️ ${sdr.name} não elegível (admissão em ${dataAdmissao})`);
}
```

### 2. Componente `TeamGoalsSummary.tsx`

**Adicionar informação visual sobre quem é elegível:**

Na seção de Ultrameta batida, mostrar:
- Total de colaboradores elegíveis
- Mencionar que novos colaboradores não recebem

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/recalculate-sdr-payout/index.ts` | Adicionar verificação de `data_admissao` antes de liberar `ifood_ultrameta` |
| `src/components/fechamento/TeamGoalsSummary.tsx` | (Opcional) Mostrar contagem de elegíveis vs não elegíveis |

---

## Fluxo Corrigido

```text
Ultrameta do Time Batida (faturamento >= R$ 1.6M)
     │
     ▼
Para cada colaborador:
     │
     ├── Buscar employees.data_admissao
     │
     ├── data_admissao NULL ou < 01/01/2026?
     │       │
     │       ├── SIM → ifood_ultrameta = R$ 1.000 (elegível)
     │       │
     │       └── NÃO → ifood_ultrameta = R$ 0 (entrou no meio do mês)
     │
     └── Somar com ifood_mensal para total_ifood
```

---

## Exemplo Prático - Janeiro 2026

| Colaborador | Data Admissão | Elegível? | iFood Ultrameta |
|-------------|---------------|-----------|-----------------|
| Julio Caetano | 01/01/2024 | SIM | R$ 1.000 |
| Thaynar | 01/01/2024 | SIM | R$ 1.000 |
| Jessica Bellini | 01/05/2024 | SIM | R$ 1.000 |
| Robert* | 15/01/2026 | NÃO | R$ 0 |
| Mateus* | 10/01/2026 | NÃO | R$ 0 |
| Evellyn* | 20/01/2026 | NÃO | R$ 0 |

*Novos colaboradores que entraram durante o mês de janeiro

---

## Resumo da Correção

1. **Soma de valores**: O iFood Ultrameta sempre soma com o iFood mensal (já está correto no código)
2. **Elegibilidade**: Adicionar verificação de `data_admissao` para filtrar novos colaboradores
3. **Pagamento**: iFood mensal no dia 1º, Ultrameta no dia 20 (regra operacional, não afeta o código)

