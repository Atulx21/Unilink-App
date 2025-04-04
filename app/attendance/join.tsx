import { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  Animated,
  Modal
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Users, Check } from 'lucide-react-native';

export default function JoinGroupScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [joinedGroupId, setJoinedGroupId] = useState<string | null>(null);
  
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

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      // Find group by join code
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('id')
        .eq('join_code', joinCode.toUpperCase())
        .single();

      if (groupError || !group) {
        throw new Error('Invalid join code');
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', group.id)
        .eq('member_id', profile.id)
        .single();

      if (existingMember) {
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

      if (memberError) throw memberError;

      // Show success popup instead of immediately navigating
      setJoinedGroupId(group.id);
      setShowSuccess(true);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (joinedGroupId) {
      router.replace(`/attendance/${joinedGroupId}`);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Join Group</Text>
      </View>

      <View style={styles.content}>
        <Users size={64} color="#1E40AF" style={styles.icon} />
        
        <Text style={styles.heading}>Enter Group Code</Text>
        <Text style={styles.description}>
          Enter the 6-character code provided by your teacher to join the group
        </Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <TextInput
          style={styles.input}
          value={joinCode}
          onChangeText={(text) => setJoinCode(text.toUpperCase())}
          placeholder="Enter 6-character code"
          placeholderTextColor="#9CA3AF"
          maxLength={6}
          autoCapitalize="characters"
        />

        <TouchableOpacity
          style={[styles.button, (loading || !joinCode.trim() || joinCode.length < 6) && styles.buttonDisabled]}
          onPress={handleJoin}
          disabled={loading || !joinCode.trim() || joinCode.length < 6}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Joining...' : 'Join Group'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Success Modal */}
      <Modal
        visible={showSuccess}
        transparent={true}
        animationType="none"
      >
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.successModal,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }]
              }
            ]}
          >
            <View style={styles.successIconContainer}>
              <Check size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.successTitle}>Joined Successfully!</Text>
            <Text style={styles.successMessage}>
              You have joined the group successfully.
            </Text>
          </Animated.View>
        </View>
      </Modal>
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  icon: {
    marginBottom: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 16,
    fontSize: 20,
    width: '100%',
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#1E40AF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#DC2626',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  successIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#10B981',
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
    color: '#6B7280',
    textAlign: 'center',
  },
});