

# Correção: iFood Ultrameta - Soma e Elegibilidade por Data de Admissão

## ✅ Status: Implementado

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

## Mudanças Implementadas

### 1. Edge Function `recalculate-sdr-payout`

**Modificações realizadas:**

1. **Busca de `data_admissao`**: Adicionado campo `data_admissao` na query do employee
2. **Verificação de elegibilidade**: Comparação entre `data_admissao` e primeiro dia do mês
3. **Condição para Closers**: Só libera `ifood_ultrameta` se `elegivelUltrameta = true`
4. **Condição para SDRs**: Mesma lógica aplicada no cálculo padrão

**Código adicionado:**

```typescript
// Verificar elegibilidade para ultrameta (precisa estar desde o início do mês)
const dataAdmissao = employeeData?.data_admissao 
  ? new Date(employeeData.data_admissao) 
  : null;
const inicioMes = new Date(year, month - 1, 1);
// Elegível se entrou antes do início do mês OU se data_admissao é null
const elegivelUltrameta = !dataAdmissao || dataAdmissao < inicioMes;

// Aplicar elegibilidade nas condições de atribuição de ifood_ultrameta
if (teamUltrametaHit && teamGoal && elegivelUltrameta) {
  ifoodUltrameta = teamGoal.ultrameta_premio_ifood || 0;
} else if (teamUltrametaHit && teamGoal && !elegivelUltrameta) {
  ifoodUltrameta = 0; // Não elegível por ter entrado no meio do mês
}
```

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

1. **Soma de valores**: O iFood Ultrameta sempre soma com o iFood mensal ✅
2. **Elegibilidade**: Verificação de `data_admissao` implementada ✅
3. **Logs**: Adicionados logs claros indicando elegibilidade ✅
