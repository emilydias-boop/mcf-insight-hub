
# Correção: Remover Funções Duplicadas

## Problema Identificado

Erro **PGRST203** - Existem duas versões da função `get_sdr_metrics_from_agenda` com assinaturas diferentes:

| Versão | Parâmetros |
|--------|------------|
| 1 | `start_date => date, end_date => date` |
| 2 | `start_date => text, end_date => text` |

O PostgREST não consegue escolher automaticamente qual usar.

## Solução

Criar uma migration que:

1. **Remove TODAS** as versões existentes da função (ambas assinaturas)
2. **Cria apenas UMA** versão com parâmetros `text` (compatível com o frontend)

## SQL da Correção

```sql
-- Passo 1: Remover TODAS as versões
DROP FUNCTION IF EXISTS public.get_sdr_metrics_from_agenda(date, date, text);
DROP FUNCTION IF EXISTS public.get_sdr_metrics_from_agenda(text, text, text);

-- Passo 2: Criar UMA única versão (text)
CREATE OR REPLACE FUNCTION public.get_sdr_metrics_from_agenda(
  start_date text,
  end_date text,
  sdr_email_filter text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
  -- Lógica completa restaurada
  -- Com parent_msa JOIN
  -- Com status != 'cancelled'
  -- Com no_show = agendamentos - r1_realizada
$$;
```

## Arquivo a Criar

| Arquivo | Descrição |
|---------|-----------|
| Nova migration SQL | Remove duplicatas + cria versão única |

## Resultado Esperado

- Erro PGRST203 eliminado
- Dashboard mostra dados corretamente
- Carol Correa: 181 Agendamentos, 124 R1 Realizada, 57 No-Show
