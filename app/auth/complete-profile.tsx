import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';

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

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      // Here you would typically upload to Supabase storage
      // For now, we'll just store the local URI
      setProfileData(prev => ({ ...prev, avatarUrl: result.assets[0].uri }));
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