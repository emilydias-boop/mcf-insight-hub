

# Correção: Filtro de BU na aba Planos OTE

## Problema Identificado

Ao selecionar uma BU específica (ex: "Incorporador"), colaboradores que não pertencem a essa BU ainda aparecem na lista porque:

| Departamento | Quantidade | Comportamento Atual |
|--------------|------------|---------------------|
| `BU - Incorporador 50K` | 12 | Filtra corretamente |
| `BU - Consórcio` | 2 | Filtra corretamente |
| `null` (vazio) | 7 | **NÃO é filtrado** |
| `Diretoria` | 1 | **NÃO é filtrado** |
| `TI` | 1 | **NÃO é filtrado** |

**Colaboradores que aparecem indevidamente:**
- Claudia Carielo (Closer R2)
- Emily Caroline Dias (Outro)
- Emily Segundario (SDR, TI)
- Grimaldo de Oliveira Melo Neto (CEO)
- Jessica Bellini R2 (Closer R2)
- Julio Caetano (Closer)
- Matheus Rodrigeus (sem cargo)
- Thaynar Tavares (Closer)
- Vinicius Motta Campos (sem cargo)

---

## Causa Técnica

Na lógica atual do filtro (linha 88-93):

```tsx
if (selectedBU !== '__all__') {
  const expectedDept = BU_MAPPING[selectedBU];
  if (expectedDept && emp.departamento !== expectedDept) {
    return false;
  }
}
```

O problema é que a comparação `emp.departamento !== expectedDept` falha silenciosamente quando `emp.departamento` é `null` ou não está no mapeamento.

---

## Solução

Inverter a lógica para **incluir apenas** quem tem o departamento esperado, ao invés de excluir quem é diferente:

```tsx
if (selectedBU !== '__all__') {
  const expectedDept = BU_MAPPING[selectedBU];
  // Só incluir se o departamento do colaborador CORRESPONDE ao esperado
  if (!expectedDept || emp.departamento !== expectedDept) {
    return false;
  }
}
```

Isso garante que:
- Se `expectedDept` não existe no mapeamento, exclui
- Se `emp.departamento` é `null`, exclui
- Se `emp.departamento` é diferente do esperado, exclui
- Só inclui se `emp.departamento === expectedDept`

---

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/fechamento/PlansOteTab.tsx` | Ajustar lógica do filtro de BU (linhas 88-93) |

---

## Resultado Esperado

| Filtro | Antes | Depois |
|--------|-------|--------|
| BU: Incorporador | 23 colaboradores (inclui CEO, TI, etc) | 12 colaboradores (apenas Incorporador) |
| BU: Consórcio | Todos aparecem | 2 colaboradores (apenas Consórcio) |
| BU: Todas | Todos aparecem | Todos aparecem (comportamento mantido) |

