

# Fix: Trigger references non-existent column `email_corporativo`

## Problem

The error `record "new" has no field "email_corporativo"` occurs when updating an employee because the trigger function `sync_employee_squad_to_profile` references `NEW.email_corporativo` on line 52 of its body, but the `employees` table only has `email_pessoal` -- there is no `email_corporativo` column.

The same issue exists in the `create-user` Edge Function which tries to insert `email_corporativo` when creating employees.

## Fix

### 1. Database migration: Fix the trigger function

Replace `NEW.email_corporativo` with `NEW.email_pessoal` in the `sync_employee_squad_to_profile` function:

```sql
CREATE OR REPLACE FUNCTION sync_employee_squad_to_profile()
...
  -- Change this line:
  WHERE LOWER(email) = LOWER(NEW.email_corporativo)
  -- To:
  WHERE LOWER(email) = LOWER(NEW.email_pessoal)
...
```

### 2. Edge Function: Fix `create-user`

Remove `email_corporativo` from the employee insert payload in `supabase/functions/create-user/index.ts` (line 179).

| File | Change |
|---|---|
| `supabase/migrations/*.sql` | Replace `email_corporativo` with `email_pessoal` in trigger function |
| `supabase/functions/create-user/index.ts` | Remove `email_corporativo` from insert payload |

