/*
  # Attendance and Academic System Tables

  1. New Tables
    - groups
      - id (uuid, primary key)
      - name (text)
      - owner_id (uuid, references profiles)
      - created_at (timestamptz)
      - updated_at (timestamptz)

    - group_members
      - id (uuid, primary key)
      - group_id (uuid, references groups)
      - member_id (uuid, references profiles)
      - role (text) - 'student' or 'teacher'
      - created_at (timestamptz)

    - attendance_sessions
      - id (uuid, primary key)
      - group_id (uuid, references groups)
      - date (date)
      - type (text) - 'manual' or 'self'
      - status (text) - 'active' or 'completed'
      - created_at (timestamptz)

    - attendance_records
      - id (uuid, primary key)
      - session_id (uuid, references attendance_sessions)
      - student_id (uuid, references profiles)
      - status (text) - 'present', 'absent', or 'penalty'
      - marked_by (uuid, references profiles)
      - created_at (timestamptz)

    - academic_posts
      - id (uuid, primary key)
      - group_id (uuid, references groups)
      - author_id (uuid, references profiles)
      - title (text)
      - content (text)
      - type (text) - 'note', 'assignment', 'announcement'
      - due_date (timestamptz)
      - created_at (timestamptz)
      - updated_at (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

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

-- Create attendance_sessions table
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  type text NOT NULL CHECK (type IN ('manual', 'self')),
  status text NOT NULL CHECK (status IN ('active', 'completed')) DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- Create attendance_records table
CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES attendance_sessions(id) NOT NULL,
  student_id uuid REFERENCES profiles(id) NOT NULL,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'penalty')),
  marked_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id, student_id)
);

-- Create academic_posts table
CREATE TABLE IF NOT EXISTS academic_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) NOT NULL,
  author_id uuid REFERENCES profiles(id) NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  type text NOT NULL CHECK (type IN ('note', 'assignment', 'announcement')),
  due_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_posts ENABLE ROW LEVEL SECURITY;

-- -- Groups Policies
-- CREATE POLICY "Users can view groups they are members of"
--   ON groups
--   FOR SELECT
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM group_members
--       WHERE group_members.group_id = groups.id
--       AND group_members.member_id = auth.uid()
--     )
--     OR owner_id = auth.uid()
--   );

-- CREATE POLICY "Teachers can create groups"
--   ON groups
--   FOR INSERT
--   TO authenticated
--   WITH CHECK (
--     EXISTS (
--       SELECT 1 FROM profiles
--       WHERE profiles.id = auth.uid()
--       AND profiles.role = 'teacher'
--     )
--   );

-- -- Group Members Policies
-- CREATE POLICY "Group owners can manage members"
--   ON group_members
--   FOR ALL
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM groups
--       WHERE groups.id = group_members.group_id
--       AND groups.owner_id = auth.uid()
--     )
--   );

-- CREATE POLICY "Users can view group members"
--   ON group_members
--   FOR SELECT
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM group_members gm
--       WHERE gm.group_id = group_members.group_id
--       AND gm.member_id = auth.uid()
--     )
--   );

-- -- Attendance Sessions Policies
-- CREATE POLICY "Teachers can manage attendance sessions"
--   ON attendance_sessions
--   FOR ALL
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM groups
--       WHERE groups.id = attendance_sessions.group_id
--       AND groups.owner_id = auth.uid()
--     )
--   );

-- CREATE POLICY "Group members can view attendance sessions"
--   ON attendance_sessions
--   FOR SELECT
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM group_members
--       WHERE group_members.group_id = attendance_sessions.group_id
--       AND group_members.member_id = auth.uid()
--     )
--   );

-- -- Attendance Records Policies
-- CREATE POLICY "Teachers can manage attendance records"
--   ON attendance_records
--   FOR ALL
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM attendance_sessions
--       JOIN groups ON groups.id = attendance_sessions.group_id
--       WHERE attendance_sessions.id = attendance_records.session_id
--       AND groups.owner_id = auth.uid()
--     )
--   );

-- CREATE POLICY "Students can mark self attendance"
--   ON attendance_records
--   FOR INSERT
--   TO authenticated
--   WITH CHECK (
--     student_id = auth.uid()
--     AND EXISTS (
--       SELECT 1 FROM attendance_sessions
--       WHERE attendance_sessions.id = attendance_records.session_id
--       AND attendance_sessions.type = 'self'
--       AND attendance_sessions.status = 'active'
--     )
--   );

-- CREATE POLICY "Users can view their attendance records"
--   ON attendance_records
--   FOR SELECT
--   TO authenticated
--   USING (
--     student_id = auth.uid()
--     OR EXISTS (
--       SELECT 1 FROM attendance_sessions
--       JOIN groups ON groups.id = attendance_sessions.group_id
--       WHERE attendance_sessions.id = attendance_records.session_id
--       AND (
--         groups.owner_id = auth.uid()
--         OR EXISTS (
--           SELECT 1 FROM group_members
--           WHERE group_members.group_id = groups.id
--           AND group_members.member_id = auth.uid()
--         )
--       )
--     )
--   );

-- Academic Posts Policies
CREATE POLICY "Teachers can manage academic posts"
  ON academic_posts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = academic_posts.group_id
      AND groups.owner_id = auth.uid()
    )
  );

CREATE POLICY "Group members can view academic posts"
  ON academic_posts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = academic_posts.group_id
      AND group_members.member_id = auth.uid()
    )
  );

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_academic_posts_updated_at
  BEFORE UPDATE ON academic_posts
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();