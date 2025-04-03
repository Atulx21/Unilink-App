import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Check, X, Clock, CircleAlert as AlertCircle } from 'lucide-react-native';

interface Session {
  id: string;
  group: {
    name: string;
  };
  date: string;
  type: 'manual' | 'self';
}

export default function MarkAttendanceScreen() {
  const { id } = useLocalSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyMarked, setAlreadyMarked] = useState(false);

  useEffect(() => {
    fetchActiveSession();
  }, [id]);

  const fetchActiveSession = async () => {
    try {
      // Get active session
      const { data: session, error: sessionError } = await supabase
        .from('attendance_sessions')
        .select(`
          id,
          date,
          type,
          group:groups(name)
        `)
        .eq('group_id', id)
        .eq('status', 'active')
        .single();

      if (sessionError) throw sessionError;
      if (!session) {
        setError('No active attendance session found');
        return;
      }

      setSession(session);

      // Check if already marked
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const { data: record } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('session_id', session.id)
        .eq('student_id', profile.id)
        .single();

      setAlreadyMarked(!!record);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const markAttendance = async (status: 'present' | 'absent') => {
    try {
      setMarking(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const { error: recordError } = await supabase
        .from('attendance_records')
        .insert({
          session_id: session?.id,
          student_id: profile.id,
          status,
          marked_by: profile.id,
        });

      if (recordError) throw recordError;

      Alert.alert(
        'Success',
        'Your attendance has been marked',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      setError(error.message);
    } finally {
      setMarking(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
      </View>
    );
  }

  if (error || !session) {
    return (
      <View style={styles.errorContainer}>
        <AlertCircle size={48} color="#DC2626" />
        <Text style={styles.errorText}>{error || 'Session not found'}</Text>
      </View>
    );
  }

  if (alreadyMarked) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Mark Attendance</Text>
          <Text style={styles.subtitle}>{session.group.name}</Text>
        </View>

        <View style={styles.content}>
          <Check size={64} color="#059669" />
          <Text style={styles.message}>
            You have already marked your attendance for this session
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mark Attendance</Text>
        <Text style={styles.subtitle}>{session.group.name}</Text>
      </View>

      <View style={styles.sessionInfo}>
        <Clock size={20} color="#6B7280" />
        <Text style={styles.date}>
          {new Date(session.date).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.prompt}>Are you present in class?</Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.presentButton]}
            onPress={() => markAttendance('present')}
            disabled={marking}
          >
            <Check size={24} color="#FFFFFF" />
            <Text style={styles.buttonText}>Yes, I'm Present</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.absentButton]}
            onPress={() => markAttendance('absent')}
            disabled={marking}
          >
            <X size={24} color="#FFFFFF" />
            <Text style={styles.buttonText}>No, I'm Absent</Text>
          </TouchableOpacity>
        </View>

        {marking && (
          <ActivityIndicator style={styles.marking} color="#1E40AF" />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    color: '#4B5563',
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginTop: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  date: {
    fontSize: 16,
    color: '#6B7280',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  prompt: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 32,
  },
  actions: {
    width: '100%',
    gap: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  presentButton: {
    backgroundColor: '#059669',
  },
  absentButton: {
    backgroundColor: '#DC2626',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  marking: {
    marginTop: 24,
  },
  message: {
    fontSize: 18,
    color: '#059669',
    textAlign: 'center',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
    marginTop: 16,
  },
});