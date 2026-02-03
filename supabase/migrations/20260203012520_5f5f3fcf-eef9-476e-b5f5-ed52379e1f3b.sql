-- APENAS converter squad para array
ALTER TABLE profiles 
  ALTER COLUMN squad TYPE TEXT[] 
  USING CASE 
    WHEN squad IS NOT NULL THEN ARRAY[squad::TEXT]
    ELSE NULL
  END;