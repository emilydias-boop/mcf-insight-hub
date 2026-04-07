

# Diagnostico: Backfill criou duplicatas + leads A010 foram roteados para pipeline errada

## O que aconteceu

### Problema 1: Leads A010 roteados para "Viver de Aluguel" em vez de "Inside Sales"

O webhook `hubla-webhook-handler` tem uma regra na linha 1506 que roteia **todo produto com categoria `ob_construir_alugar`** (Construir Para Alugar) para o pipeline "VIVER DE ALUGUEL":

```text
productCategory === 'ob_construir_alugar' → VIVER_ALUGUEL_ORIGIN_ID
```

O problema: quando um lead compra A010 + order bump "Construir Para Alugar", o webhook processa os dois produtos separadamente. O A010 cria deal corretamente no "PIPELINE INSIDE SALES", mas o "Construir Para Alugar" cria um **segundo deal** no "VIVER DE ALUGUEL".

**Caso Rafaela Regis**: Ela comprou A010 + Construir Para Alugar (offer). O webhook criou o contato e um deal em "Viver de Aluguel" primeiro (pelo OB). O A010 nao criou deal no Inside Sales porque o webhook Make Sync processou antes mas **nao cria deals, so transacoes**. Resultado: ela ficou apenas no pipeline errado.

**5 leads afetados** (criados Apr 6-7 em Viver de Aluguel, todos com compras A010):

| Lead | Email | Deal Inside Sales? |
|------|-------|-------------------|
| Fernando Palma Saboia | saboia.arq@gmail.com | Sim (duplicado) |
| Kitison Unicacio | kitison4578@gmail.com | Sim (duplicado) |
| Rafaela Regis | rafaela.regis@atrativarh.com.br | Sim (manual, adicionado depois) |
| ALLAN CALADO | allan.calado@gmail.com | Nao |
| Paulo Eduardo Rebelo | drpaulorebelo@gmail.com | Nao |

### Problema 2: Contatos duplicados (Hilton Jamal)

Hilton Jamal aparece 2x porque tem 2 contatos nao arquivados com emails diferentes (`hiljamal@gmail.com` e `hilton_jamal@yahoo.com.br`) e telefones ligeiramente diferentes (`+5517991229718` vs `17991229718`). A deduplicacao por sufixo de 9 digitos nao resolveu porque ambos vieram de fontes diferentes antes do merge ser implementado.

## Correcoes

### 1. Database: Mover deals errados de "Viver de Aluguel" para "Inside Sales"

Para os 5 deals criados erroneamente em "Viver de Aluguel":
- **Fernando e Kitison**: ja tem deal no Inside Sales → deletar o deal do Viver de Aluguel (duplicado)
- **Rafaela**: ja foi adicionada manualmente ao Inside Sales → deletar o deal do Viver de Aluguel
- **Allan e Paulo**: nao tem deal no Inside Sales → mover o deal para "PIPELINE INSIDE SALES" e atribuir via round-robin (ou manter sem dono para distribuicao manual)

### 2. Database: Merge contato duplicado Hilton Jamal

Arquivar o contato mais novo, mover deals para o mais antigo.

### 3. Codigo: Corrigir roteamento no `hubla-webhook-handler`

Alterar a logica na linha 1506: quando o lead tem **compra A010 confirmada**, o order bump "Construir Para Alugar" **nao deve criar deal separado** no Viver de Aluguel. Deve apenas registrar a transacao e, se ja existe deal no Inside Sales, adicionar tag.

Logica proposta:
```text
Se productCategory === 'ob_construir_alugar':
  1. Verificar se o contato ja tem deal no Inside Sales (via email/phone)
  2. Se sim → nao criar deal no Viver de Aluguel, apenas adicionar tag 'ob-construir-alugar' ao deal existente
  3. Se nao → verificar se tem compra A010 confirmada
     - Se sim → nao criar deal (sera criado pelo webhook A010)
     - Se nao → criar deal no Viver de Aluguel normalmente (compra avulsa)
```

### Arquivos

| Arquivo | Acao |
|---------|------|
| Migration SQL (insert tool) | Deletar 3 deals duplicados + mover 2 deals para Inside Sales + merge Hilton |
| `supabase/functions/hubla-webhook-handler/index.ts` | Corrigir logica de roteamento OB Construir |

