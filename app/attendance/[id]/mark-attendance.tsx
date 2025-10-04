import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, CheckCircle, X, AlertCircle, Calendar, Clock } from 'lucide-react-native';

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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

      if (sessionError) {
        if (sessionError.code === 'PGRST116') {
          // No active session found - this is not an error
          setSession(null);
          return;
        }
        throw sessionError;
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
      setError(null);
      setSuccessMessage(null);

      // Get user profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      // Create attendance record
      const { error: recordError } = await supabase
        .from('attendance_records')
        .insert({
          session_id: session.id,
          student_id: profile.id,
          status: status,
          marked_by: profile.id,
        });

      if (recordError) throw recordError;

      // Show success message
      setSuccessMessage(`Your attendance has been marked as ${status}!`);
      
      // Set already marked to prevent multiple submissions
      setAlreadyMarked(true);
      
      // Optional: Auto navigate back after a delay
      setTimeout(() => {
        router.back();
      }, 3000);
    } catch (error) {
      setError(error.message);
    } finally {
      setMarking(false);
    }
  };

  const goBack = () => {
    router.back();
  };

  // Remove duplicate loading check - we already have one at the beginning of the render
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E40AF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={goBack}
          >
            <ArrowLeft size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.title}>Mark Attendance</Text>
          <View style={styles.headerRight} />
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <AlertCircle size={48} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={fetchActiveSession}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : !session ? (
          <View style={styles.noSessionContainer}>
            <AlertCircle size={48} color="#F59E0B" />
            <Text style={styles.noSessionText}>No active attendance session found</Text>
            <Text style={styles.noSessionSubtext}>
              Please wait for your teacher to start an attendance session
            </Text>
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={fetchActiveSession}
            >
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : successMessage ? (
          <View style={styles.successContainer}>
            <CheckCircle size={64} color="#059669" />
            <Text style={styles.successTitle}>Success!</Text>
            <Text style={styles.successMessage}>{successMessage}</Text>
            <Text style={styles.redirectingText}>Redirecting back...</Text>
          </View>
        ) : alreadyMarked ? (
          <View style={styles.alreadyMarkedContainer}>
            <CheckCircle size={48} color="#059669" />
            <Text style={styles.alreadyMarkedTitle}>Already Marked</Text>
            <Text style={styles.alreadyMarkedText}>
              You have already marked your attendance for this session
            </Text>
            <TouchableOpacity
              style={styles.backToGroupButton}
              onPress={goBack}
            >
              <Text style={styles.backToGroupButtonText}>Back to Group</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.sessionContainer}>
            <View style={styles.sessionCard}>
              <Text style={styles.sessionTitle}>Active Session</Text>
              <Text style={styles.groupName}>{session.group.name}</Text>
              
              <View style={styles.sessionDetails}>
                <View style={styles.sessionDetailRow}>
                  <Calendar size={18} color="#4B5563" />
                  <Text style={styles.sessionDetailText}>
                    {new Date(session.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Text>
                </View>
                
                <View style={styles.sessionDetailRow}>
                  <Clock size={18} color="#4B5563" />
                  <Text style={styles.sessionDetailText}>
                    {session.type === 'manual' ? 'Manual' : 'Self'} Attendance
                  </Text>
                </View>
              </View>
            </View>
            
            <Text style={styles.markPrompt}>Mark your attendance now</Text>
            
            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={[styles.button, styles.presentButton, marking && styles.buttonDisabled]}
                onPress={() => markAttendance('present')}
                disabled={marking}
              >
                <CheckCircle size={24} color="#FFFFFF" />
                <Text style={styles.buttonText}>Present</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.absentButton, marking && styles.buttonDisabled]}
                onPress={() => markAttendance('absent')}
                disabled={marking}
              >
                <X size={24} color="#FFFFFF" />
                <Text style={styles.buttonText}>Absent</Text>
              </TouchableOpacity>
            </View>
            
            {marking && (
              <View style={styles.markingContainer}>
                <ActivityIndicator size="small" color="#1E40AF" />
                <Text style={styles.markingText}>Marking attendance...</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    elevation: 2,
  },
  backButton: {
    padding: 8,
  },
  headerRight: {
    width: 40, // Same width as backButton for balance
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  noSessionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  noSessionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  noSessionSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
    maxWidth: '80%',
  },
  refreshButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#059669',
    marginTop: 16,
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 18,
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 24,
  },
  redirectingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  alreadyMarkedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alreadyMarkedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
    marginTop: 16,
    marginBottom: 8,
  },
  alreadyMarkedText: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: '80%',
  },
  backToGroupButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backToGroupButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  sessionContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 12,
  },
  groupName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  sessionDetails: {
    gap: 12,
  },
  sessionDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionDetailText: {
    fontSize: 15,
    color: '#4B5563',
  },
  markPrompt: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 24,
    textAlign: 'center',
  },
  buttonsContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 24,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.7,
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
  markingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  markingText: {
    fontSize: 14,
    color: '#4B5563',
  },
  sessionDate: {
    color: '#6B7280',
  },
});