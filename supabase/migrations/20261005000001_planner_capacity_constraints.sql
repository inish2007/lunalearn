ALTER TABLE profiles
  ADD COLUMN available_hours_per_day NUMERIC(4, 2)
  CHECK (available_hours_per_day IS NULL OR (available_hours_per_day >= 0 AND available_hours_per_day <= 24));

ALTER TABLE topics
  ADD COLUMN estimated_study_hours NUMERIC(8, 2)
  CHECK (estimated_study_hours IS NULL OR estimated_study_hours > 0);