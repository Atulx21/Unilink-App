-- Create marks table
CREATE TABLE IF NOT EXISTS marks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  max_marks INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create student_marks table
CREATE TABLE IF NOT EXISTS student_marks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mark_id UUID REFERENCES marks(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  marks INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(mark_id, student_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS marks_group_id_idx ON marks(group_id);
CREATE INDEX IF NOT EXISTS student_marks_mark_id_idx ON student_marks(mark_id);
CREATE INDEX IF NOT EXISTS student_marks_student_id_idx ON student_marks(student_id);

-- Enable Row Level Security
ALTER TABLE marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_marks ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_marks_updated_at
  BEFORE UPDATE ON marks
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_student_marks_updated_at
  BEFORE UPDATE ON student_marks
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- RLS Policies for marks table
CREATE POLICY "Teachers can manage marks"
  ON marks
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

CREATE POLICY "Group members can view marks"
  ON marks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = marks.group_id
      AND group_members.member_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policies for student_marks table
CREATE POLICY "Teachers can manage student marks"
  ON student_marks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marks
      JOIN groups ON groups.id = marks.group_id
      WHERE marks.id = student_marks.mark_id
      AND groups.owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Students can view their own marks"
  ON student_marks
  FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM marks
      JOIN groups ON groups.id = marks.group_id
      WHERE marks.id = student_marks.mark_id
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
          AND group_members.role = 'teacher'
        )
      )
    )
  );