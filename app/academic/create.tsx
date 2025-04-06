import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Animated } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Check, X } from 'lucide-react-native';

export default function CreateAcademicGroupScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [subject, setSubject] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (showSuccess) {
      // Start animations when success modal is shown
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Auto-navigate after 2 seconds
      const timer = setTimeout(() => {
        handleContinue();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  const generateGroupCode = () => {
    // Generate a 6-character alphanumeric code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreate = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!groupName.trim()) {
        throw new Error('Please enter a group name');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');
      
      // Verify user is a teacher
      if (profile.role !== 'teacher') {
        throw new Error('Only teachers can create academic groups');
      }

      // Generate a unique invite code
      let inviteCode;
      let isCodeUnique = false;
      while (!isCodeUnique) {
        inviteCode = generateGroupCode();
        const { data: existingGroup, error } = await supabase
          .from('groups')
          .select('id')
          .eq('invite_code', inviteCode)
          .single();
        
        if (error && !existingGroup) {
          isCodeUnique = true;
        }
      }

      // Create academic group with invite code
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: groupName,
          subject: subject.trim() || null,
          owner_id: profile.id,
          type: 'academic',
          invite_code: inviteCode,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add owner as a member
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          member_id: profile.id,
          role: 'teacher',
        });

      if (memberError) throw memberError;

      // Show success popup with the generated code
      setGeneratedCode(inviteCode);
      setCreatedGroupId(group.id);
      setShowSuccess(true);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (createdGroupId) {
      router.replace(`/academic/${createdGroupId}`);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Create Academic Group</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Group Name</Text>
          <TextInput
            style={styles.input}
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Enter group name"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Subject (Optional)</Text>
          <TextInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            placeholder="e.g. Mathematics, Physics, etc."
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.createButton, loading && styles.disabledButton]}
          onPress={handleCreate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.createButtonText}>Create Group</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Success Modal */}
      {showSuccess && (
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.successModal,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <View style={styles.successIconContainer}>
              <Check size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.successTitle}>Group Created!</Text>
            <Text style={styles.successMessage}>
              Your academic group has been created successfully.
            </Text>
            <View style={styles.codeContainer}>
              <Text style={styles.codeLabel}>Invite Code:</Text>
              <Text style={styles.codeValue}>{generatedCode}</Text>
              <Text style={styles.codeHelp}>Share this code with students to join your group</Text>
            </View>
          </Animated.View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    elevation: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4B5563',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  createButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: '#93C5FD',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  successModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    alignItems: 'center',
    elevation: 5,
  },
  successIconContainer: {
    backgroundColor: '#1E40AF',
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 16,
  },
  codeContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  codeLabel: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
  },
  codeValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E40AF',
    letterSpacing: 2,
    marginBottom: 8,
  },
  codeHelp: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
});