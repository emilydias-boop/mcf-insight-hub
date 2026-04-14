

## Plano: Permitir SDRs lerem datas liberadas da agenda

### Problema
A tabela `automation_settings` tem RLS restrita a admins. SDRs não conseguem ler `agenda_released_dates_*`, então o calendário de agendamento não mostra as datas liberadas (como quinta-feira).

### Correção
Criar uma migration com uma nova policy SELECT na `automation_settings` para usuários autenticados lerem apenas registros de datas liberadas:

```sql
CREATE POLICY "Authenticated users can read released dates"
ON public.automation_settings
FOR SELECT
TO authenticated
USING (key LIKE 'agenda_released_dates_%');
```

### Resultado
- SDRs verão apenas hoje, amanhã e as datas explicitamente liberadas
- Se você liberar apenas hoje e amanhã, eles verão somente esses dois dias
- A restrição de escrita (apenas admins) permanece inalterada

