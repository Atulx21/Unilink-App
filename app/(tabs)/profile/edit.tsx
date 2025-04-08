import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Image, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

interface Profile {
  name: string;
  role: 'student' | 'teacher';
  institute_name: string;
  department: string;
  roll_number?: string;
  current_semester?: string;
  avatar_url?: string;
}

export default function EditProfileScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      setError(error.message);
    }
  };

  const pickImage = async () => {
    try {
      // Request permissions first
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'We need access to your photos to upload an image.');
        return;
      }
  
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
  
      if (!result.canceled && profile) {
        const imageUrl = await uploadProfileImage(result.assets[0].uri);
        setProfile({ ...profile, avatar_url: imageUrl });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to upload profile image. Please try again.');
    }
  };

  const uploadProfileImage = async (uri: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');
  
      // Generate a unique file name
      const fileExt = uri.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
  
      // For iOS, we need to handle file:// protocol
      const fileUri = Platform.OS === 'ios' ? uri.replace('file://', '') : uri;
  
      // Create form data
      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        name: fileName,
        type: `image/${fileExt}`
      } as any);
  
      // Delete old profile image if exists
      if (profile?.avatar_url) {
        const oldPath = profile.avatar_url.split('/').slice(-2).join('/');
        await supabase.storage
          .from('profile_images')
          .remove([oldPath]);
      }
  
      // Upload to Supabase storage
      const { data, error: uploadError } = await supabase.storage
        .from('profile_images')
        .upload(filePath, formData, {
          contentType: `image/${fileExt}`,
          upsert: true
        });
  
      if (uploadError) throw uploadError;
  
      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile_images')
        .getPublicUrl(filePath);
  
      return publicUrl;
    } catch (error) {
      console.error('Error uploading profile image:', error);
      throw error;
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          name: profile?.name,
          institute_name: profile?.institute_name,
          department: profile?.department,
          roll_number: profile?.role === 'student' ? profile?.roll_number : null,
          current_semester: profile?.role === 'student' ? profile?.current_semester : null,
          avatar_url: profile?.avatar_url,
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      router.back();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Edit Profile</Text>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
        <Image
          source={{
            uri: profile.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
          }}
          style={styles.avatar}
        />
        <Text style={styles.changePhotoText}>Change Photo</Text>
      </TouchableOpacity>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={profile.name}
            onChangeText={(text) => setProfile({ ...profile, name: text })}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Institute Name</Text>
          <TextInput
            style={styles.input}
            value={profile.institute_name}
            onChangeText={(text) => setProfile({ ...profile, institute_name: text })}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Department</Text>
          <TextInput
            style={styles.input}
            value={profile.department}
            onChangeText={(text) => setProfile({ ...profile, department: text })}
          />
        </View>

        {profile.role === 'student' && (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Roll Number</Text>
              <TextInput
                style={styles.input}
                value={profile.roll_number}
                onChangeText={(text) => setProfile({ ...profile, roll_number: text })}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Current Semester</Text>
              <TextInput
                style={styles.input}
                value={profile.current_semester}
                onChangeText={(text) => setProfile({ ...profile, current_semester: text })}
              />
            </View>
          </>
        )}

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  error: {
    marginTop: 8,
    color: '#DC2626',
    fontSize: 14,
  },
  avatarContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 12,
  },
  changePhotoText: {
    color: '#1E40AF',
    fontSize: 16,
    fontWeight: '600',
  },
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#1E40AF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});