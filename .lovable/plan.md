
## Contexto (o que deveria acontecer)
O botão/card **“Enviar NFSe”** aparece na tela **“Meu Fechamento”** (rota `/meu-fechamento`) quando **todas** as condições abaixo são verdadeiras:

1) O mês selecionado tem um payout (`payout` existe)  
2) `payout.status === 'APPROVED'`  
3) `payout.nfse_id` está vazio (a NFSe ainda não foi enviada)  
4) O hook `useMyEmployee()` retorna um `employee` (variável `myEmployee` não pode ser `null`)  

Pelos prints, você está no lugar correto (Meu Fechamento / detalhes), o payout já está **Aprovado**, mas o card não aparece porque o `myEmployee` está vindo **null**.

---

## Diagnóstico (por que o `myEmployee` está `null` mesmo com fallback)
Pelos requests de rede do navegador:

- `GET /employees?user_id=eq.<uid>` → retorna `[]`
- `GET /employees?email_pessoal=ilike.<email>` → retorna `[]`

Mas no banco existe o registro do Cleiton em `employees` com:
- `email_pessoal = cleiton.lima@minhacasafinanciada.com`
- `user_id = NULL`

Isso é um sinal clássico de **RLS (Row Level Security) bloqueando SELECT** na tabela `employees`.  
Mesmo buscando por email, a policy provavelmente exige `employees.user_id = auth.uid()`; como `user_id` está nulo, o Supabase retorna **200 com lista vazia** (não dá erro).

Conclusão: o fallback por email no frontend não resolve enquanto a tabela `employees` estiver protegida por RLS (como deve estar, pois contém dados sensíveis). O caminho correto é **vincular `employees.user_id` ao usuário autenticado**.

---

## Objetivo
Garantir que:
- Cleiton (e demais colaboradores com cadastro em `employees`) consigam ser “enxergados” via RLS
- O card “Enviar NFSe” apareça automaticamente assim que o fechamento estiver `APPROVED` e sem `nfse_id`

---

## Implementação (o que vou fazer quando você aprovar a execução)
### 1) Criar uma migração SQL segura para vincular `employees.user_id` via `auth.users`
Em vez de usar `profiles.id` (que pode não existir em `auth.users` e quebrar por FK), faremos a vinculação usando `auth.users.id` por email:

- Atualizar **somente** quando:
  - `employees.user_id is null`
  - `employees.email_pessoal` não é nulo
  - existe um usuário em `auth.users` com `auth.users.email = employees.email_pessoal`

SQL (modelo):
```sql
update public.employees e
set user_id = u.id
from auth.users u
where e.user_id is null
  and e.email_pessoal is not null
  and lower(e.email_pessoal) = lower(u.email);
```

Isso:
- respeita o FK para `auth.users`
- não tenta criar vínculos “fantasmas”
- corrige em massa os casos em que existe usuário autenticável para aquele email

### 2) Validar o caso do Cleiton especificamente
Após a migração:
- Confirmar que `employees.user_id` do Cleiton passou a ser o `uid` dele.
- Confirmar que `useMyEmployee()` passa a retornar um registro (o request `/employees?user_id=eq.<uid>` deve voltar com 1 linha).

### 3) Confirmar o comportamento de UI (sem mudar layout)
Sem alterar a tela, o card deve aparecer automaticamente ao recarregar, pois a condição já existe no `MeuFechamento.tsx`:

- `payout.status === 'APPROVED'`
- `!payout.nfse_id`
- `myEmployee` definido

### 4) Passos de teste (o que você/ele deve fazer)
No usuário do Cleiton:

1. Abrir `/meu-fechamento`
2. Selecionar **Janeiro 2026**
3. Confirmar que aparece o card amarelo “Fechamento Aprovado! Envie sua NFSe…”
4. Clicar **Enviar NFSe**
5. No modal, anexar o PDF/XML (dependendo do que o modal pedir) e enviar
6. Após sucesso, deve aparecer o card verde “NFSe Enviada” com o botão “Ver NFSe”

---

## Riscos e cuidados
- `employees` contém dados pessoais; a RLS deve continuar restritiva. A correção ideal é **ligar o `user_id`**, não abrir acesso por email via policy.
- Emails divergentes (ex.: `email_pessoal` diferente do email de login) não serão vinculados automaticamente. Nesses casos, precisaremos corrigir o email no RH ou fazer um vínculo manual pontual.

---

## Entregáveis
- 1 migração SQL nova em `supabase/migrations/*` fazendo o update via `auth.users`
- (Opcional, se necessário) um ajuste pequeno de observabilidade: log/telemetria discreta no frontend para indicar “employee não encontrado” (sem expor dados sensíveis)

