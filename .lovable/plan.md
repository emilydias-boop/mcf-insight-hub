

## Plano: Corrigir filtros de periodo e tentativas no CRM para coordenadores

### Causa raiz

A tabela `calls` possui uma politica RLS de SELECT que so permite acesso para:
- O proprio usuario (`user_id = auth.uid()`)
- Admins (`has_role('admin')`)
- Managers (`has_role('manager')`)

Thobson tem a role `coordenador`, que nao esta incluida. Ele nao fez nenhuma ligacao pessoalmente — as ligacoes dos deals dele foram feitas por SDRs. Resultado: o hook `useBatchDealActivitySummary` retorna `totalCalls = 0` e `lastContactAttempt = null` para todos os deals dele.

Isso faz com que:
- **Filtro de inatividade** (`+ de 3 dias`): como `lastContactAttempt` e null, o codigo assume "sem atividade = muito inativo" e TODOS os deals passam no filtro
- **Filtro de tentativas** (`0 a 1`): como `totalCalls = 0` para todos, TODOS os deals passam no filtro (0 esta entre 0 e 1)

Os filtros parecem nao funcionar, mas na verdade funcionam — so que com dados zerados por falta de permissao de leitura.

### Alteracao

**Migracao SQL** — Alterar a RLS da tabela `calls` para incluir `coordenador`:

```sql
DROP POLICY "Users can view their own calls" ON public.calls;

CREATE POLICY "Users can view their own calls"
ON public.calls
FOR SELECT
TO public
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'coordenador'::app_role)
);
```

### Resultado

Coordenadores como Thobson poderao ler as ligacoes de todos os deals, fazendo com que os filtros de inatividade e tentativas funcionem corretamente — filtrando deals com base nos dados reais de atividade.

