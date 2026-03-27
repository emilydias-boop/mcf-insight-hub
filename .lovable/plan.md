

## Fix: Vendas de Parceria mostrando 0 no Carrinho R2

### Causa raiz

O hook `useR2CarrinhoVendas` busca transacoes de parceria da semana e tenta vincular aos leads aprovados por **email** (do CRM contact) e **telefone** (attendee_phone ou CRM contact phone). Se nenhum match ocorre, retorna array vazio.

A tela mostra **"Vendas Sem Vinculo (5)"** — ou seja, 5 transacoes de parceria EXISTEM, mas nao matcham com nenhum aprovado. Isso indica que:

1. Os emails dos clientes no Hubla (`customer_email`) nao batem com os emails no CRM (`crm_contacts.email`)
2. Os telefones tambem nao batem — ou os aprovados nao tem deal/contact linkado

### Problema adicional

O `R2VendasList` chama `useR2CarrinhoVendas(weekStart, weekEnd)` SEM o `config`, ignorando o horario de corte configurado. Isso pode excluir transacoes perto do limite.

### Solucao

**1. Hook `useR2CarrinhoVendas.ts` — Melhorar matching**

Adicionar mais estrategias de matching alem de email e telefone:
- **Match por `attendee_phone` direto** (hoje so usa `att.attendee_phone`, mas a comparacao pode falhar por formato)
- **Match por nome normalizado** como fallback (UPPER + TRIM)
- **Match por sufixo de 9 digitos** do telefone (hoje usa 11 digitos, mas muitos telefones tem formatos inconsistentes como `41998554545` vs `+5541998554545`)

Alterar `normalizeForMatch` para usar **9 digitos** (ultimos 9) em vez de 11 — isso elimina problemas de DDD/+55.

**2. Hook `useR2CarrinhoVendas.ts` — Incluir A010 transactions**

Verificar se transacoes de produto A010 (que sao upgrades/parceria) tambem devem ser incluidas. Atualmente filtra apenas `product_category = 'parceria'`.

**3. `R2VendasList.tsx` — Passar config**

Atualizar para receber e usar `carrinhoConfig` na chamada do hook.

**4. `R2Carrinho.tsx` — Passar config ao componente**

Enviar `config` como prop para `R2VendasList`.

### Detalhes tecnicos

Mudanca principal no matching (sufixo 9 digitos):
```
// Antes: slice(-11) — falha com formatos diferentes
// Depois: slice(-9) — pega apenas o numero local (sem DDD variavel)
const normalizeForMatch = (phone: string | null): string | null => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : null;
};
```

Fallback por nome:
```
// Se email e telefone nao matcham, tentar nome normalizado
const txName = tx.customer_name?.toUpperCase().trim();
if (!matched && txName && nameMap.has(txName)) {
  matched = true;
  attendeeData = nameMap.get(txName);
}
```

### Arquivos alterados
- `src/hooks/useR2CarrinhoVendas.ts` — matching com 9 digitos + fallback nome + receber config
- `src/hooks/useUnlinkedTransactions.ts` — alinhar matching com 9 digitos
- `src/components/crm/R2VendasList.tsx` — aceitar e usar config prop
- `src/pages/crm/R2Carrinho.tsx` — passar config para R2VendasList

