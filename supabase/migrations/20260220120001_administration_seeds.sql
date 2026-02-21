-- Default income types (inserted per-org via trigger)
CREATE OR REPLACE FUNCTION public.seed_default_income_types()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO income_types (org_id, name) VALUES
    (NEW.id, 'Anticipo'),
    (NEW.id, 'Cuota'),
    (NEW.id, 'Pago final'),
    (NEW.id, 'Otros');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_seed_income_types
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_income_types();
