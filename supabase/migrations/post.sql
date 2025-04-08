-- Create posts table if it doesn't exist
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create post_likes table for tracking likes
CREATE TABLE IF NOT EXISTS post_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(post_id, user_id)
);

-- Create post_comments table for comments
CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_post_comments_updated_at
  BEFORE UPDATE ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Create policies for posts
CREATE POLICY "Anyone can view posts"
  ON posts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create their own posts"
  ON posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own posts"
  ON posts
  FOR UPDATE
  TO authenticated
  USING (
    author_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own posts"
  ON posts
  FOR DELETE
  TO authenticated
  USING (
    author_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Create policies for post likes
CREATE POLICY "Anyone can view post likes"
  ON post_likes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can like posts"
  ON post_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can unlike posts"
  ON post_likes
  FOR DELETE
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Create policies for post comments
CREATE POLICY "Anyone can view post comments"
  ON post_comments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can comment on posts"
  ON post_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own comments"
  ON post_comments
  FOR UPDATE
  TO authenticated
  USING (
    author_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own comments"
  ON post_comments
  FOR DELETE
  TO authenticated
  USING (
    author_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Create storage bucket for post images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('post_images', 'post_images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policy for post images
CREATE POLICY "Anyone can view post images"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'post_images');

CREATE POLICY "Users can upload post images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'post_images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their own post images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'post_images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own post images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'post_images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );