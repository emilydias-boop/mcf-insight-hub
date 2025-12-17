-- Vincular user_id da Julia ao seu registro SDR
UPDATE sdr 
SET user_id = '794a2257-422c-4b38-9014-3135d9e26361'
WHERE email = 'julia.caroline@minhacasafinanciada.com';

-- Também vincular outros SDRs que têm email correspondente no profiles
UPDATE sdr s
SET user_id = p.id
FROM profiles p
WHERE LOWER(s.email) = LOWER(p.email)
  AND s.user_id IS NULL;