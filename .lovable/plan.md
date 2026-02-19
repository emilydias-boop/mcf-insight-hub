

# Criar Deal no CRM Consorcio quando Lead compra "Construir para Alugar"

## O que muda
Quando um lead compra o curso "Construir para Alugar" (ou "Viver de Aluguel" / "Como Viver de Aluguel"), o sistema vai automaticamente criar um deal no pipeline **"PIPELINE - INSIDE SALES - VIVER DE ALUGUEL"** no estagio **"NOVO LEAD"**.

Hoje esses produtos sao registrados como transacoes financeiras mas nao geram nenhum deal no CRM de Consorcio.

## Como vai funcionar

1. Webhook Hubla recebe pagamento de "Construir para Alugar" (categoria `ob_construir_alugar`)
2. Na primeira parcela, o sistema cria automaticamente:
   - Um contato no CRM (ou reutiliza existente)
   - Um deal no pipeline "Viver de Aluguel" no estagio "NOVO LEAD"
   - Tags: `Construir-Alugar`, `Hubla`
3. Se o lead ja tiver um deal nesse pipeline, apenas atualiza (nao duplica)

## Detalhes Tecnicos

### Arquivo: `supabase/functions/hubla-webhook-handler/index.ts`

**1. Adicionar constantes do pipeline Viver de Aluguel** (junto das constantes de Consorcio existentes, ~linha 994):

```
const VIVER_ALUGUEL_ORIGIN_ID = '4e2b810a-6782-4ce9-9c0d-10d04c018636';
const STAGE_VIVER_ALUGUEL_NOVO_LEAD = '2c69bf1d-94d5-4b6d-928d-dcf12da2d78c';
```

**2. Adicionar `ob_construir_alugar` ao mapa de categorias de Consorcio:**

Adicionar ao `CONSORCIO_STAGE_MAP`:
```
'ob_construir_alugar': STAGE_VIVER_ALUGUEL_NOVO_LEAD,
```

Adicionar ao `CONSORCIO_PRODUCT_CATEGORIES`:
```
const CONSORCIO_PRODUCT_CATEGORIES = ['clube_arremate', 'contrato_clube_arremate', 'renovacao', 'ob_construir_alugar'];
```

**3. Ajustar a funcao `createDealForConsorcioProduct`** para usar a origin correta:

Quando a categoria for `ob_construir_alugar`, usar `VIVER_ALUGUEL_ORIGIN_ID` em vez de `CONSORCIO_ORIGIN_ID`. Isso garante que o deal caia no pipeline correto.

Isso e necessario porque a funcao existente sempre usa `CONSORCIO_ORIGIN_ID` (Efeito Alavanca + Clube), mas "Construir para Alugar" pertence a outro pipeline.

**4. Nenhuma mudanca no frontend** -- o CRM ja exibe deals do pipeline "Viver de Aluguel" normalmente na pagina de Negocios.

## Cobertura

A mudanca cobre os 3 pontos de entrada do webhook:
- `NewSale` (linha ~1340)
- `invoice.payment_succeeded` sem items (linha ~1466)
- `invoice.payment_succeeded` com items (linha ~1602)

Todos ja verificam `CONSORCIO_PRODUCT_CATEGORIES.includes(productCategory)`, entao basta adicionar a categoria na lista.

