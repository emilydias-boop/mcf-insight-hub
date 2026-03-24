

## Plano: Executar backfill A010 real (90 dias)

### Análise da lógica atual

O código já implementa **5 camadas de deduplicação**:

1. **Email exato** - busca contato por email (batch de 200)
2. **Telefone (sufixo 9 dígitos)** - busca contato por phone suffix para quem não tem match por email
3. **Deal por contact_id** - verifica se contato já tem deal no PIS
4. **Deal por email cross-check** - busca deals via JOIN com crm_contacts pelo email (cobre contatos duplicados)
5. **Double-check antes de criar** - no momento real da criação, faz verificação final por email (case insensitive) E por telefone

A lógica está robusta. Nenhuma alteração de código é necessária.

### Execução

| Passo | Ação |
|-------|------|
| 1 | Deploy da função (já deployada) |
| 2 | Executar com `{ "dry_run": false, "days_back": 90 }` via `supabase--curl_edge_functions` |
| 3 | Verificar stats retornados (deals criados, erros, skips) |

### Riscos mitigados
- Se email já tem deal no PIS → SKIP
- Se telefone (9 dígitos) bate com contato que já tem deal → SKIP  
- Se é parceiro (A001-A009, INCORPORADOR, ANTICRISE) → SKIP
- Double-check individual antes de cada insert → evita race conditions

