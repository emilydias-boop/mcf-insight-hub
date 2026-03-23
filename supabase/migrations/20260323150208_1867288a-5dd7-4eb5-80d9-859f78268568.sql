UPDATE sdr SET active = false 
WHERE email IN (
  SELECT s.email FROM sdr s
  JOIN profiles p ON lower(p.email) = lower(s.email)
  WHERE p.access_status IN ('bloqueado', 'desativado')
  AND s.active = true
);