

# Bloquear SDR de acessar Fechamento da Equipe

## Problema

A Carol (SDR) consegue acessar `/fechamento-sdr` (Fechamento Equipe) que mostra todos os payouts da equipe. Ela deveria ter acesso apenas ao `/meu-fechamento`.

O menu lateral já esconde o link para SDRs (só aparece para admin/manager/coordenador), mas a **rota** usa `ResourceGuard` que pode conceder acesso via permissões do recurso `fechamento_sdr`.

## Solução

### Arquivo: `src/App.tsx`

Adicionar restrição de role nas 3 rotas do fechamento de equipe, combinando `RoleGuard` com `ResourceGuard`:

```
/fechamento-sdr         → RoleGuard(['admin','manager','coordenador']) + ResourceGuard
/fechamento-sdr/config  → idem
/fechamento-sdr/:id     → idem
```

Isso garante que mesmo acessando a URL diretamente, o SDR será bloqueado e redirecionado.

## Resultado esperado
- SDR/Closer: só acessa `/meu-fechamento`
- Admin/Manager/Coordenador: acessa tanto `/fechamento-sdr` quanto `/meu-fechamento`

