UPDATE public.sdr
   SET allowed_origin_ids = ARRAY[
     'ea7aac02-3a69-422a-9f6e-691c8a04f06a', -- Cobrança Consorcio
     '7d7b1cb5-2a44-4552-9eff-c3b798646b78'  -- Efeito Alavanca + Clube (default Consórcio)
   ]
 WHERE id = '03ce75af-ef81-4522-9a5d-992a857b1806';