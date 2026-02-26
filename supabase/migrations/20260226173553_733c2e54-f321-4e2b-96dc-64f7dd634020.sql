
ALTER TABLE public.team_monthly_goals
  ADD COLUMN meta_divina_modo TEXT NOT NULL DEFAULT 'individual',
  ADD COLUMN meta_divina_top_n INTEGER NOT NULL DEFAULT 1;
