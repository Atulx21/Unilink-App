import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import { router, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { Image as ImageIcon, X, ArrowLeft } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';

export default function CreatePostScreen() {
  const [content, setContent] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Add permission check on component mount
  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to upload images!');
      }
    })();
  }, []);

  const pickImage = async () => {
    try {
      // Request permissions first
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'We need access to your photos to upload an image.');
        return;
      }
      
      // Use minimal options to avoid type issues
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.8,
      });
  
      console.log('Image picker result:', result);
  
      if (!result.canceled) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const removeImage = () => {
    setImage(null);
  };

  const createPost = async () => {
    if (!content.trim()) {
      Alert.alert('Error', 'Please enter some content for your post');
      return;
    }

    try {
      setLoading(true);

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No user found');

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
        
      if (profileError) throw profileError;

      let imageUrl = null;

      // Upload image if selected
      if (image) {
        try {
          // Generate a unique file name
          const fileExt = image.split('.').pop();
          const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
          const filePath = `${user.id}/${fileName}`;

          console.log('Preparing to upload image:', { fileExt, fileName, filePath });

          // Read the file info
          const fileInfo = await FileSystem.getInfoAsync(image);
          
          if (fileInfo.exists) {
            console.log('File exists, preparing upload');
            
            // For iOS, we need to handle file:// protocol
            const fileUri = Platform.OS === 'ios' ? image.replace('file://', '') : image;
            
            const formData = new FormData();
            formData.append('file', {
              uri: fileUri,
              name: fileName,
              type: `image/${fileExt}`
            } as any);

            console.log('Uploading with formData');

            // Make sure the bucket exists
            const { data: bucketData, error: bucketError } = await supabase.storage.getBucket('post_images');
            if (bucketError && bucketError.message.includes('not found')) {
              // Create bucket if it doesn't exist
              await supabase.storage.createBucket('post_images', { public: true });
            }

            // Upload using the Supabase JS client instead of fetch
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('post_images')
              .upload(filePath, formData, {
                contentType: `image/${fileExt}`,
                upsert: true
              });

            if (uploadError) {
              console.error('Upload error:', uploadError);
              throw new Error(`Failed to upload image: ${uploadError.message}`);
            }

            console.log('Upload successful:', uploadData);

            // Get public URL
            const { data: urlData } = supabase.storage
              .from('post_images')
              .getPublicUrl(filePath);

            imageUrl = urlData.publicUrl;
            console.log('Image URL:', imageUrl);
          } else {
            console.error('File does not exist:', image);
            throw new Error('Image file not found');
          }
        } catch (uploadError) {
          console.error('Error in image upload:', uploadError);
          Alert.alert('Upload Error', 'Failed to upload image. Creating post without image.');
          // Continue without image
        }
      }

      // Create post
      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert({
          author_id: profile.id,
          content: content.trim(),
          image_url: imageUrl,
        })
        .select()
        .single();

      if (postError) throw postError;

      Alert.alert('Success', 'Post created successfully');
      router.back();
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', error.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Post</Text>
        <TouchableOpacity 
          style={[
            styles.postButton,
            (!content.trim() || loading) && styles.postButtonDisabled
          ]}
          onPress={createPost}
          disabled={!content.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.postButtonText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          style={styles.input}
          placeholder="What's on your mind?"
          placeholderTextColor="#9CA3AF"
          multiline
          value={content}
          onChangeText={setContent}
          autoFocus
        />

        {image && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: image }} style={styles.previewImage} />
            <TouchableOpacity 
              style={styles.removeImageButton}
              onPress={removeImage}
            >
              <X size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.mediaButton}
          onPress={pickImage}
        >
          <ImageIcon size={24} color="#1E40AF" />
          <Text style={styles.mediaButtonText}>Add Photo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  postButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  postButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  input: {
    fontSize: 18,
    color: '#1F2937',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  imageContainer: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    padding: 16,
  },
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  mediaButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#1F2937',
  },
});