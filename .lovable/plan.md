
# Migração de Área: Jessica Martins com Dupla Função (SDR + Closer R2)

## Objetivo

Configurar Jessica Martins para exercer **duas funções simultaneamente**:
1. **SDR do Inside Sales** (função atual) - Continua agendando R1
2. **Closer de R2** (nova função) - Passa a realizar reuniões R2

## Situação Atual

| Tabela | Status |
|--------|--------|
| `profiles` | ✅ Existe (id: `b0ea004d-ca72-4190-ab69-a9685b34bd06`) |
| `employees` | ✅ Existe (cargo: SDR, departamento: BU Incorporador 50K) |
| `sdr` | ✅ Existe (role_type: `sdr`, squad: `incorporador`, nível 5) |
| `user_roles` | ✅ Tem role `sdr` |
| `closers` (R2) | ❌ **Não existe** |

## Implementação

### 1. Adicionar Jessica como Closer R2

Inserir registro na tabela `closers` com `meeting_type = 'r2'`:

```sql
INSERT INTO closers (name, email, is_active, meeting_type, priority, max_leads_per_slot, color, employee_id)
VALUES (
  'Jessica Martins',
  'jessica.martins@minhacasafinanciada.com',
  true,
  'r2',
  4,  -- Prioridade 4 (após Claudia, Jessica Bellini, Thobson)
  3,  -- Até 3 leads por reunião
  '#F97316',  -- Laranja para diferenciar
  'f9659204-4fb8-4fa4-b0b6-951484b00866'  -- employee_id
);
```

### 2. Adicionar Role de Closer

Adicionar a role `closer` na tabela `user_roles` (a role `sdr` permanece):

```sql
INSERT INTO user_roles (user_id, role)
VALUES ('b0ea004d-ca72-4190-ab69-a9685b34bd06', 'closer')
ON CONFLICT (user_id, role) DO NOTHING;
```

### 3. Atualizar Constantes (Opcional)

Adicionar Jessica Martins à lista `CLOSER_LIST` em `src/constants/team.ts`:

```typescript
export const CLOSER_LIST = [
  // ... closers existentes ...
  { nome: "Jessica Martins", variations: ["jessica martins", "Jessica Martins", "Jéssica Martins"] },
];
```

### 4. Configurar Disponibilidade R2 (Via Interface)

Após a criação do registro de Closer R2, você poderá:
1. Acessar `/crm/configurar-closers-r2`
2. Clicar em "Disponibilidade"
3. Configurar os horários de R2 para Jessica Martins

## Resultado Esperado

Após a implementação:

| Funcionalidade | Resultado |
|----------------|-----------|
| Kanban Inside Sales | Jessica continua aparecendo como owner de deals |
| Agenda R1 | Jessica continua podendo agendar R1 como SDR |
| Agenda R2 | Jessica aparece como opção de Closer R2 |
| Fechamento SDR | Métricas de SDR continuam sendo calculadas |
| Relatórios Closer | Jessica entra nos relatórios de Closer R2 |

## Detalhes Técnicos

### Tabelas Afetadas

| Tabela | Ação |
|--------|------|
| `closers` | INSERT (novo registro com meeting_type='r2') |
| `user_roles` | INSERT (adicionar role 'closer') |
| `closer_meeting_links` | Configurado via UI após criação |

### Dados de Jessica Martins

| Campo | Valor |
|-------|-------|
| Profile ID | `b0ea004d-ca72-4190-ab69-a9685b34bd06` |
| Employee ID | `f9659204-4fb8-4fa4-b0b6-951484b00866` |
| SDR ID | `11111111-0001-0001-0001-000000000011` |
| Email | `jessica.martins@minhacasafinanciada.com` |

### Closers R2 Ativos Atuais

1. **Claudia Carielo** - Prioridade 1, max 3 leads
2. **Jessica Bellini** - Prioridade 2, max 1 lead  
3. **Thobson Motta** - Prioridade 3, max 1 lead
4. **Jessica Martins** - Prioridade 4, max 3 leads (NOVO)

## SQL Completo para Execução

```sql
-- 1. Criar registro de Closer R2 para Jessica Martins
INSERT INTO closers (name, email, is_active, meeting_type, priority, max_leads_per_slot, color, employee_id)
VALUES (
  'Jessica Martins',
  'jessica.martins@minhacasafinanciada.com',
  true,
  'r2',
  4,
  3,
  '#F97316',
  'f9659204-4fb8-4fa4-b0b6-951484b00866'
);

-- 2. Adicionar role de closer (mantém sdr também)
INSERT INTO user_roles (user_id, role)
VALUES ('b0ea004d-ca72-4190-ab69-a9685b34bd06', 'closer')
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Verificar resultado
SELECT c.name, c.email, c.meeting_type, c.priority, c.is_active
FROM closers c
WHERE c.meeting_type = 'r2' AND c.is_active = true
ORDER BY c.priority;

SELECT ur.role, p.full_name, p.email
FROM user_roles ur
JOIN profiles p ON p.id = ur.user_id
WHERE ur.user_id = 'b0ea004d-ca72-4190-ab69-a9685b34bd06';
```

## Próximos Passos (Pós-Aprovação)

1. Executar o SQL para criar o registro de Closer R2
2. Acessar `/crm/configurar-closers-r2` para configurar disponibilidade
3. Testar agendamento de R2 para Jessica Martins
4. (Opcional) Atualizar `src/constants/team.ts` se necessário para validações
