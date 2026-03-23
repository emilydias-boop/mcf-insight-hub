

## Plano: Sincronizar status do SDR com perfil do usuário

### Problema

Os SDRs Yanca, Evellyn e Hellen aparecem na tabela de reuniões porque na tabela `sdr` estão com `active = true`, mesmo tendo o perfil bloqueado/desativado:

| SDR | sdr.active | profiles.access_status | employees.status |
|-----|-----------|----------------------|-----------------|
| Evellyn | true | bloqueado | - |
| Hellen | true | bloqueado | - |
| Yanca | true | desativado | desligado |

O hook `useSdrsFromSquad` filtra apenas por `sdr.active = true`, ignorando o status real do perfil.

### Solução

Duas ações complementares:

**1. Correção imediata (migration)**: Desativar os SDRs cujo perfil está bloqueado/desativado:
```sql
UPDATE sdr SET active = false 
WHERE email IN (
  SELECT s.email FROM sdr s
  JOIN profiles p ON lower(p.email) = lower(s.email)
  WHERE p.access_status IN ('bloqueado', 'desativado')
  AND s.active = true
);
```

**2. Prevenção futura**: No hook `useSdrsFromSquad`, adicionar JOIN com `profiles` para filtrar SDRs cujo perfil está ativo, garantindo que mesmo se o `sdr.active` estiver dessincronizado, o SDR não apareça:

| Arquivo | O que muda |
|---------|-----------|
| `src/hooks/useSdrsFromSquad.ts` | Após buscar SDRs ativos, fazer segunda query em `profiles` para excluir os com `access_status != 'ativo'` |

### Resultado
- SDRs desligados/bloqueados não aparecem mais na tabela de reuniões
- Futuras desativações de perfil automaticamente excluem o SDR da listagem

