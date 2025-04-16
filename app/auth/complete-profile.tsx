import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

export default function CompleteProfile() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<'student' | 'teacher' | null>(null);
  const [profileData, setProfileData] = useState({
    name: '',
    instituteName: '',
    department: '',
    rollNumber: '',
    currentSemester: '',
    avatarUrl: '',
  });

  // Add the same pickImage and uploadProfileImage functions from the edit profile screen
  // Make sure to import FileSystem from expo-file-system
  
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
  
      if (!result.canceled) {
        const imageUrl = await uploadProfileImage(result.assets[0].uri);
        setProfileData(prev => ({ ...prev, avatarUrl: imageUrl }));
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

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: user.id,
          name: profileData.name,
          role: role,
          institute_name: profileData.instituteName,
          department: profileData.department,
          roll_number: role === 'student' ? profileData.rollNumber : null,
          current_semester: role === 'student' ? profileData.currentSemester : null,
          avatar_url: profileData.avatarUrl,
        });

      if (profileError) throw profileError;

      router.replace('/(tabs)');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Complete Your Profile</Text>
      <Text style={styles.subtitle}>Tell us more about yourself</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.roleContainer}>
        <TouchableOpacity 
          style={[styles.roleButton, role === 'student' && styles.roleButtonActive]}
          onPress={() => setRole('student')}
        >
          <Text style={[styles.roleText, role === 'student' && styles.roleTextActive]}>Student</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.roleButton, role === 'teacher' && styles.roleButtonActive]}
          onPress={() => setRole('teacher')}
        >
          <Text style={[styles.roleText, role === 'teacher' && styles.roleTextActive]}>Teacher</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
        {profileData.avatarUrl ? (
          <Image source={{ uri: profileData.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>Add Photo</Text>
          </View>
        )}
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Full Name"
        value={profileData.name}
        onChangeText={(text) => setProfileData(prev => ({ ...prev, name: text }))}
      />

      <TextInput
        style={styles.input}
        placeholder="Institute Name"
        value={profileData.instituteName}
        onChangeText={(text) => setProfileData(prev => ({ ...prev, instituteName: text }))}
      />

      <TextInput
        style={styles.input}
        placeholder="Department"
        value={profileData.department}
        onChangeText={(text) => setProfileData(prev => ({ ...prev, department: text }))}
      />

      {role === 'student' && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Roll Number"
            value={profileData.rollNumber}
            onChangeText={(text) => setProfileData(prev => ({ ...prev, rollNumber: text }))}
          />

          <TextInput
            style={styles.input}
            placeholder="Current Semester"
            value={profileData.currentSemester}
            onChangeText={(text) => setProfileData(prev => ({ ...prev, currentSemester: text }))}
          />
        </>
      )}

      <TouchableOpacity 
        style={styles.button}
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Creating Profile...' : 'Complete Profile'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 10,
    color: '#1E40AF',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
    gap: 20,
  },
  roleButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  roleButtonActive: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  roleText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  roleTextActive: {
    color: '#fff',
  },
  avatarContainer: {
    alignSelf: 'center',
    marginBottom: 30,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  avatarPlaceholderText: {
    color: '#6B7280',
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
  },
  button: {
    backgroundColor: '#1E40AF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  error: {
    color: '#dc2626',
    marginBottom: 15,
    textAlign: 'center',
  },
});