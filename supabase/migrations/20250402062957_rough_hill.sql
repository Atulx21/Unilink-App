/*
  # Create Tables and Update Policies

  1. Tables Created:
    - groups
    - group_members
    - attendance_sessions
    - attendance_records
    - academic_posts

  2. Security:
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

-- Drop existing policies if they exist
DO $$ 
BEGIN
  -- Profile policies
  DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
  DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
  
  -- Group policies
  DROP POLICY IF EXISTS "Users can view groups they are members of" ON groups;
  DROP POLICY IF EXISTS "Teachers can create groups" ON groups;
  DROP POLICY IF EXISTS "Group owners can manage members" ON group_members;
  DROP POLICY IF EXISTS "Users can view group members" ON group_members;
  
  -- Attendance policies
  DROP POLICY IF EXISTS "Teachers can manage attendance sessions" ON attendance_sessions;
  DROP POLICY IF EXISTS "Group members can view attendance sessions" ON attendance_sessions;
  DROP POLICY IF EXISTS "Teachers can manage attendance records" ON attendance_records;
  DROP POLICY IF EXISTS "Students can mark self attendance" ON attendance_records;
  DROP POLICY IF EXISTS "Users can view their attendance records" ON attendance_records;
  
  -- Academic post policies
  DROP POLICY IF EXISTS "Teachers can manage academic posts" ON academic_posts;
  DROP POLICY IF EXISTS "Group members can view academic posts" ON academic_posts;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Profile Policies
CREATE POLICY "Profiles are viewable by authenticated users"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can create their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Group Policies
CREATE POLICY "Groups are viewable by members and owners"
  ON groups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = id
      AND group_members.member_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
    OR owner_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can create groups"
  ON groups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'teacher'
    )
  );

CREATE POLICY "Group owners can update their groups"
  ON groups
  FOR UPDATE
  TO authenticated
  USING (
    owner_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    owner_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Group Members Policies
CREATE POLICY "Group members are viewable by group members"
  ON group_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_id
      AND gm.member_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Group owners can manage members"
  ON group_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = group_id
      AND groups.owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Attendance Session Policies
CREATE POLICY "Teachers can manage attendance sessions"
  ON attendance_sessions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = group_id
      AND groups.owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Group members can view attendance sessions"
  ON attendance_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_id
      AND group_members.member_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Attendance Records Policies
CREATE POLICY "Teachers can manage attendance records"
  ON attendance_records
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM attendance_sessions
      JOIN groups ON groups.id = attendance_sessions.group_id
      WHERE attendance_sessions.id = session_id
      AND groups.owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Students can mark self attendance"
  ON attendance_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM attendance_sessions
      WHERE id = session_id
      AND type = 'self'
      AND status = 'active'
    )
  );

CREATE POLICY "Users can view attendance records"
  ON attendance_records
  FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM attendance_sessions
      JOIN groups ON groups.id = attendance_sessions.group_id
      WHERE attendance_sessions.id = session_id
      AND (
        groups.owner_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM group_members
          WHERE group_members.group_id = groups.id
          AND group_members.member_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
          )
        )
      )
    )
  );

-- Academic Posts Policies
CREATE POLICY "Teachers can manage academic posts"
  ON academic_posts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = group_id
      AND groups.owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Group members can view academic posts"
  ON academic_posts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_id
      AND group_members.member_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Create triggers for updated_at timestamps
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