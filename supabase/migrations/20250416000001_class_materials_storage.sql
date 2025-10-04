-- Create storage bucket for class materials if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('class_materials', 'class_materials', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for class materials
-- Anyone can view class materials
CREATE POLICY "Anyone can view class materials"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'class_materials');

-- All authenticated users can upload class materials
CREATE POLICY "Authenticated users can upload class materials"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'class_materials');

-- Users can update their own uploaded materials
CREATE POLICY "Users can update their own uploaded materials"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'class_materials' AND
    (auth.uid() = owner)
  );

-- Users can delete their own uploaded materials
CREATE POLICY "Users can delete their own uploaded materials"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'class_materials' AND
    (auth.uid() = owner)
  );

-- Create materials table if it doesn't exist
CREATE TABLE IF NOT EXISTS materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL,
  uploaded_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on materials table
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- Group members can view materials
CREATE POLICY "Group members can view materials"
  ON materials
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      JOIN profiles ON profiles.id = group_members.member_id
      WHERE group_members.group_id = materials.group_id
      AND profiles.user_id = auth.uid()
    )
  );

-- Teachers can manage materials
CREATE POLICY "Teachers can manage materials"
  ON materials
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      JOIN profiles ON profiles.id = group_members.member_id
      WHERE group_members.group_id = materials.group_id
      AND group_members.role = 'teacher'
      AND profiles.user_id = auth.uid()
    )
  );