-- Create groups table
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create group_members table
CREATE TABLE IF NOT EXISTS group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) NOT NULL,
  member_id uuid REFERENCES profiles(id) NOT NULL,
  role text NOT NULL CHECK (role IN ('student', 'teacher')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, member_id)
);

-- -- Create attendance_sessions table
-- CREATE TABLE IF NOT EXISTS attendance_sessions (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   group_id uuid REFERENCES groups(id) NOT NULL,
--   date date NOT NULL DEFAULT CURRENT_DATE,
--   type text NOT NULL CHECK (type IN ('manual', 'self')),
--   status text NOT NULL CHECK (status IN ('active', 'completed')) DEFAULT 'active',
--   created_at timestamptz DEFAULT now()
-- );

-- -- Create attendance_records table
-- CREATE TABLE IF NOT EXISTS attendance_records (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   session_id uuid REFERENCES attendance_sessions(id) NOT NULL,
--   student_id uuid REFERENCES profiles(id) NOT NULL,
--   status text NOT NULL CHECK (status IN ('present', 'absent', 'penalty')),
--   marked_by uuid REFERENCES profiles(id) NOT NULL,
--   created_at timestamptz DEFAULT now(),
--   UNIQUE(session_id, student_id)
-- );

-- ALTER TABLE attendance_records ADD COLUMN marked_at timestamptz DEFAULT now();
 
ALTER TABLE groups 
-- ADD COLUMN allow_self_attendance BOOLEAN DEFAULT TRUE,
-- ADD COLUMN attendance_window INTEGER DEFAULT 15,
ADD COLUMN penalty_threshold INTEGER DEFAULT 3;

-- Add join_code column to groups table
ALTER TABLE groups
ADD COLUMN join_code text;

-- Add unique constraint to join_code
ALTER TABLE groups
ADD CONSTRAINT unique_join_code UNIQUE (join_code);

-- Update group policies to allow joining via code
CREATE POLICY "Users can view groups they have the join code for"
  ON groups
  FOR SELECT
  TO authenticated
  USING (
    join_code IS NOT NULL
    AND join_code = current_setting('request.join_code', true)::text
  );

  -- Create posts table
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES profiles(id) NOT NULL,
  content text NOT NULL,
  image_url text,
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create post_likes table for tracking likes
CREATE TABLE IF NOT EXISTS post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Create post_comments table for comments
CREATE TABLE IF NOT EXISTS post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;


-- Add columns needed for academic groups
ALTER TABLE groups
ADD COLUMN IF NOT EXISTS subject text,
ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'general',
ADD COLUMN IF NOT EXISTS invite_code text;

-- Add unique constraint to invite_code if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_invite_code'
  ) THEN
    ALTER TABLE groups ADD CONSTRAINT unique_invite_code UNIQUE (invite_code);
  END IF;
EXCEPTION WHEN others THEN
  -- Constraint might already exist with a different name
  NULL;
END$$;

-- Example query to insert an academic group
-- INSERT INTO groups (name, subject, owner_id, type, invite_code)
-- VALUES ('Physics 101', 'Physics', '123e4567-e89b-12d3-a456-426614174000', 'academic', 'ABC123');

 