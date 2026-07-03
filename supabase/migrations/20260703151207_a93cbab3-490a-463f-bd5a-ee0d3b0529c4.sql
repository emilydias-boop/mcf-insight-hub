
CREATE OR REPLACE FUNCTION public.checkin_autocreate_from_attendee()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_exists BOOLEAN;
  v_email TEXT;
BEGIN
  IF NEW.contract_paid_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.contract_paid_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.email INTO v_email
    FROM public.crm_contacts c
   WHERE c.id = NEW.contact_id
   LIMIT 1;

  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.checkin_rooms
    WHERE lower(customer_email) = lower(v_email)
       OR attendee_id = NEW.id
  ) INTO v_exists;

  IF v_exists THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.checkin_rooms (
    customer_name, customer_email, customer_phone,
    product_name, purchase_date, attendee_id, deal_id
  ) VALUES (
    COALESCE(NEW.attendee_name, v_email),
    v_email,
    NEW.attendee_phone,
    'A000 - Contrato',
    NEW.contract_paid_at,
    NEW.id,
    NEW.deal_id
  );

  RETURN NEW;
END;
$$;
