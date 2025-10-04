import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Animated } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Check, X } from 'lucide-react-native';

export default function JoinAcademicGroupScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [joinedGroupId, setJoinedGroupId] = useState<string | null>(null);
  const [joinedGroupName, setJoinedGroupName] = useState<string>('');
  
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

  const handleJoin = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!joinCode.trim() || joinCode.length < 6) {
        throw new Error('Please enter a valid 6-character code');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw new Error('Could not fetch your profile');
      if (!profile) throw new Error('Profile not found');

      // Find group by join code
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('id, name, type')
        .eq('invite_code', joinCode.toUpperCase())
        .eq('type', 'academic')
        .single();

      if (groupError || !group) {
        throw new Error('Invalid join code or not an academic group');
      }

      // Check if already a member
      const { data: existingMember, error: memberCheckError } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', group.id)
        .eq('member_id', profile.id)
        .single();

      if (!memberCheckError && existingMember) {
        throw new Error('You are already a member of this group');
      }

      // Add user as a member
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          member_id: profile.id,
          role: profile.role,
        });

      if (memberError) throw new Error('Failed to join the group');

      // Show success popup
      setJoinedGroupId(group.id);
      setJoinedGroupName(group.name);
      setShowSuccess(true);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (joinedGroupId) {
      router.replace(`/academic/${joinedGroupId}`);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Join Academic Group</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Enter Group Code</Text>
          <TextInput
            style={styles.input}
            value={joinCode}
            onChangeText={(text) => setJoinCode(text.toUpperCase())}
            placeholder="Enter 6-character code"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="characters"
            maxLength={6}
          />
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.joinButton, loading && styles.disabledButton]}
          onPress={handleJoin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.joinButtonText}>Join Group</Text>
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
            <Text style={styles.successTitle}>Joined Successfully!</Text>
            <Text style={styles.successMessage}>
              You have joined "{joinedGroupName}" group.
            </Text>
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
    textAlign: 'center',
    letterSpacing: 4,
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
  joinButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: '#6EE7B7',
  },
  joinButtonText: {
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
    backgroundColor: '#10B981',
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
  },
});