CREATE TABLE IF NOT EXISTS behavioral_health_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    astronaut_id UUID NOT NULL REFERENCES astronauts(id),
    mood TEXT NOT NULL CHECK (
        mood IN ('Very Good', 'Good', 'Neutral', 'Low', 'Very Low')
    ),
    stress_level INT CHECK (stress_level BETWEEN 1 AND 10),
    journal_entry TEXT,
    sentiment TEXT CHECK (
        sentiment IN ('positive', 'neutral', 'negative')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_behavioral_checkins_astronaut_time
ON behavioral_health_checkins(astronaut_id, created_at DESC);
-- Support account-level ownership for astronauts and flight surgeons.
BEGIN;

ALTER TABLE behavioral_health_checkins
ADD COLUMN IF NOT EXISTS user_id UUID;

-- Backfill existing astronaut check-ins.
UPDATE behavioral_health_checkins bh
SET user_id = a.user_id
FROM astronauts a
WHERE bh.astronaut_id = a.id
  AND bh.user_id IS NULL;

-- Flight Surgeons do not require an astronaut profile.
ALTER TABLE behavioral_health_checkins
ALTER COLUMN astronaut_id DROP NOT NULL;

-- Every check-in must belong to an authenticated user.
ALTER TABLE behavioral_health_checkins
ALTER COLUMN user_id SET NOT NULL;

-- Add the user foreign key if it does not already exist.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_behavioral_health_user'
    ) THEN
        ALTER TABLE behavioral_health_checkins
        ADD CONSTRAINT fk_behavioral_health_user
        FOREIGN KEY (user_id) REFERENCES users(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_behavioral_checkins_user_time
ON behavioral_health_checkins(user_id, created_at DESC);

COMMIT;