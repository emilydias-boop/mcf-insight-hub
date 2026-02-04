
# Plano: Fechamento Unificado para Toda Equipe do Consórcio

## Contexto

A página de Fechamento do Consórcio (`/consorcio/fechamento`) atualmente mostra apenas 1 pessoa porque o sistema depende da tabela `sdr` que não está completa. Você precisa que **todos os 7 funcionários ativos da BU** apareçam:

- Ithaline (SDR)
- Cleiton Lima (SDR) ✅ único que aparece
- João Pedro (Closer)
- Luis Felipe (Supervisor) 
- Thobson Motta (Closer R2)
- Victoria (Closer)
- Ygor (SDR)

## Problema Identificado

O fluxo atual é:
```text
employees (RH) → sdr_id → sdr → sdr_month_payout
```

Mas apenas **Cleiton** tem o campo `employees.sdr_id` preenchido. Os outros 6 funcionários não têm vínculo e, portanto, não geram payout.

## Solução Proposta

### Fase 1: Vincular Funcionários à Tabela SDR (Migração de Dados)

Criar registros na tabela `sdr` para os funcionários que não possuem e vincular via `employees.sdr_id`.

**Para SDRs (Ithaline, Ygor):**
- Criar registro em `sdr` com `role_type = 'sdr'`, `squad = 'consorcio'`
- Vincular `employees.sdr_id`

**Para Closers (João Pedro, Victoria):**
- Criar registro em `sdr` com `role_type = 'closer'`, `squad = 'consorcio'`
- Vincular `employees.sdr_id`

**Para Supervisor (Luis Felipe):**
- Criar registro em `sdr` com `role_type = 'sdr'` ou novo tipo
- Vincular `employees.sdr_id`

**Para Closer R2/Sócio (Thobson):**
- Atualmente é excluído pelo filtro `cargo !== 'Closer R2'`
- Confirmar se deve ser incluído ou mantido excluído

### Fase 2: Atualizar Emails (Essencial para Métricas)

O sistema precisa do email para buscar métricas via RPC. Preencher `employees.email_pessoal` e `sdr.email` para todos os funcionários.

### Fase 3: Rodar Recálculo

Após vínculos criados:
1. Clicar "Recalcular Todos" na página de Fechamento
2. Todos os 7 (ou 6 sem Closer R2) funcionários aparecerão

## Detalhamento Técnico

### Migração SQL (Fase 1 + 2)

```sql
-- 1. Criar registros na tabela sdr para funcionários sem vínculo
INSERT INTO sdr (id, name, email, squad, role_type, active, meta_diaria)
SELECT 
  gen_random_uuid(),
  e.nome_completo,
  e.email_pessoal,
  'consorcio',
  CASE 
    WHEN e.cargo LIKE '%Closer%' THEN 'closer'
    ELSE 'sdr'
  END,
  true,
  3  -- meta diária padrão
FROM employees e
WHERE e.departamento = 'BU - Consórcio'
  AND e.status = 'ativo'
  AND e.sdr_id IS NULL
  AND e.cargo != 'Closer R2'  -- excluir sócios
RETURNING id, name;

-- 2. Vincular employees.sdr_id aos novos registros
UPDATE employees e
SET sdr_id = s.id
FROM sdr s
WHERE e.departamento = 'BU - Consórcio'
  AND e.status = 'ativo'
  AND e.sdr_id IS NULL
  AND e.cargo != 'Closer R2'
  AND LOWER(TRIM(e.nome_completo)) = LOWER(TRIM(s.name))
  AND s.squad = 'consorcio';
```

### Arquivos a Modificar (Opcional - Melhorias de UX)

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/bu-consorcio/Fechamento.tsx` | Adicionar aba "Equipe Geral" ou unificar todas as abas |
| `src/pages/bu-consorcio/FechamentoConfig.tsx` | Adicionar seção para vincular funcionários automaticamente |

## Informação Necessária

Para executar a migração completa, preciso dos emails de:

| Funcionário | Email Pessoal |
|-------------|---------------|
| Ithaline clara dos santos | ? |
| João Pedro Martins Vieira | ? |
| Luis Felipe | ? |
| Victoria da Silva Paz | ? |
| Ygor Fereira | ? |

Sem os emails, os payouts serão criados mas as métricas (R1 Agendadas, Realizadas, etc.) ficarão zeradas.

## Resultado Esperado

Após a implementação:
- Todos os funcionários da BU Consórcio aparecerão nas abas de Fechamento
- Cada cargo terá seu cálculo específico (SDR vs Closer)
- O botão "Recalcular Todos" processará toda a equipe
- O Supervisor Luis Felipe também terá payout (modelo a definir)

## Decisões Pendentes

1. **Thobson Motta (Closer R2)** - Deve ser incluído no fechamento ou mantido excluído como "sócio"?
2. **Luis Felipe (Supervisor)** - Qual modelo de remuneração usar? SDR, Closer ou customizado?
3. **Emails** - Quais são os emails corretos de cada funcionário?
