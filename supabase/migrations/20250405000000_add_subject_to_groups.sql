-- Add subject field for academic groups
ALTER TABLE groups
ADD COLUMN IF NOT EXISTS subject text;

-- Add type column to groups table if it doesn't exist
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'general';

-- Add invite_code column to groups table if it doesn't exist
ALTER TABLE groups
ADD COLUMN IF NOT EXISTS invite_code text UNIQUE;