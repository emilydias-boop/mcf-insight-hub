
# Plano: Adicionar Pipeline "VIVER DE ALUGUEL" ao CRM Consórcio

## Contexto
A pipeline **"PIPELINE - INSIDE SALES - VIVER DE ALUGUEL"** existe no banco de dados mas não aparece no dropdown do CRM Consórcio porque:
1. Ela pertence ao grupo **"Perpétuo - X1"** (ID: `a6f3cbfc-0567-427f-a405-5a869aaa6010`)
2. Esse grupo não está mapeado para a BU Consórcio

## Dados Identificados

| Item | Valor |
|------|-------|
| Pipeline | PIPELINE - INSIDE SALES - VIVER DE ALUGUEL |
| Origin ID | `4e2b810a-6782-4ce9-9c0d-10d04c018636` |
| Grupo | Perpétuo - X1 |
| Grupo ID | `a6f3cbfc-0567-427f-a405-5a869aaa6010` |

## Alterações Necessárias

### 1. Inserir no Banco de Dados
Adicionar a pipeline como uma **origin mapeada** para o Consórcio na tabela `bu_origin_mapping`:

```text
INSERT INTO bu_origin_mapping (bu, entity_type, entity_id, is_default)
VALUES ('consorcio', 'origin', '4e2b810a-6782-4ce9-9c0d-10d04c018636', false);
```

### 2. Atualizar Fallback no Código
Adicionar o grupo "Perpétuo - X1" ao `BU_GROUP_MAP` do Consórcio para garantir que a pipeline apareça mesmo se o banco estiver indisponível.

**Arquivo:** `src/components/auth/NegociosAccessGuard.tsx`

**Alteração no BU_GROUP_MAP (linha 35-39):**
```typescript
consorcio: [
  'b98e3746-d727-445b-b878-fc5742b6e6b8', // Perpétuo - Construa para Alugar
  '267905ec-8fcf-4373-8d62-273bb6c6f8ca', // Hubla - Viver de Aluguel
  '35361575-d8a9-4ea0-8703-372a2988d2be', // Hubla - Construir Para Alugar
  'a6f3cbfc-0567-427f-a405-5a869aaa6010', // Perpétuo - X1 (contém PIPELINE - INSIDE SALES - VIVER DE ALUGUEL)
],
```

## Resultado Esperado
Após a implementação, a pipeline "PIPELINE - INSIDE SALES - VIVER DE ALUGUEL" aparecerá:
- No dropdown de funis do CRM Consórcio
- Na sidebar de origens ao selecionar "Perpétuo - X1"
- Disponível para SDRs que têm acesso multi-pipeline no Consórcio

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| Banco de dados (via SQL) | Inserir mapeamento na `bu_origin_mapping` |
| `src/components/auth/NegociosAccessGuard.tsx` | Adicionar grupo ao `BU_GROUP_MAP` |
