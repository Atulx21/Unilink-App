import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Check, X, TriangleAlert as AlertTriangle } from 'lucide-react-native';

interface Student {
  id: string;
  name: string;
  roll_number: string;
  attendance_status: 'present' | 'absent' | null;
}

export default function SelfAttendanceSessionScreen() {
  const { id, sessionId } = useLocalSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [markingAttendance, setMarkingAttendance] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  useEffect(() => {
    fetchStudents();
    getCurrentUser();
    setupRealTimeUpdates();
    // Removed the periodic refresh interval
  }, [sessionId]);
  
  // Add manual refresh function
  const handleRefresh = () => {
    setRefreshing(true);
    fetchStudents()
      .then(() => setRefreshing(false))
      .catch((error) => {
        console.error('Error refreshing:', error);
        setRefreshing(false);
      });
  };
  
  const setupRealTimeUpdates = () => {
    // Set up real-time subscription to attendance_records table
    const subscription = supabase
      .channel(`attendance_records_${sessionId}`)
      .on('postgres_changes', {
        event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
        schema: 'public',
        table: 'attendance_records',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        console.log('Attendance record changed, refreshing data...', payload);
        fetchStudents();
      })
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
        if (status !== 'SUBSCRIBED') {
          console.warn('Failed to subscribe to real-time updates. Please use manual refresh.');
        }
      });
      
    return subscription;
  };

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
        
      if (profile) {
        setCurrentUserId(profile.id);
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
  };

  const fetchStudents = async () => {
    try {
      // Get all students in the group
      const { data: members, error: membersError } = await supabase
        .from('group_members')
        .select(`
          member_id,
          profiles(
            id,
            name,
            roll_number
          )
        `)
        .eq('group_id', id)
        .eq('role', 'student');

      if (membersError) throw membersError;

      // Get current attendance records
      const { data: records, error: recordsError } = await supabase
        .from('attendance_records')
        .select('student_id, status')
        .eq('session_id', sessionId);

      if (recordsError) throw recordsError;

      const recordMap = new Map(records?.map(r => [r.student_id, r.status]));

      const formattedStudents = members.map(member => ({
        id: member.profiles.id,
        name: member.profiles.name,
        roll_number: member.profiles.roll_number || '',
        attendance_status: recordMap.get(member.profiles.id) || null,
      }));

      // Sort students by roll number
      const sortedStudents = formattedStudents.sort((a, b) => {
        return a.roll_number.localeCompare(b.roll_number, undefined, { numeric: true });
      });

      setStudents(sortedStudents);
      return sortedStudents; // Return for promise chaining
    } catch (error) {
      setError(error.message);
      throw error; // Rethrow for promise chaining
    } finally {
      setLoading(false);
    }
  };

  const endSession = async () => {
    try {
      setSubmitting(true);
      setError(null);

      // First, update the session status to completed
      const { error: sessionUpdateError } = await supabase
        .from('attendance_sessions')
        .update({ status: 'completed' })
        .eq('id', sessionId);

      if (sessionUpdateError) throw sessionUpdateError;

      // Get the latest attendance records to ensure we have the most up-to-date data
      const { data: latestRecords, error: recordsQueryError } = await supabase
        .from('attendance_records')
        .select('student_id')
        .eq('session_id', sessionId);

      if (recordsQueryError) throw recordsQueryError;

      // Create a set of student IDs who have already marked attendance
      const markedStudentIds = new Set(latestRecords?.map(record => record.student_id) || []);

      // Mark all unmarked students as absent
      const unmarkedStudents = students
        .filter(student => !markedStudentIds.has(student.id))
        .map(student => ({
          session_id: sessionId,
          student_id: student.id,
          status: 'absent',
          marked_by: student.id, // Self-marked
          // Remove the marked_at field since it doesn't exist in the database
        }));

      if (unmarkedStudents.length > 0) {
        console.log(`Marking ${unmarkedStudents.length} students as absent by default`);
        
        const { error: recordsError } = await supabase
          .from('attendance_records')
          .insert(unmarkedStudents);
    
        if (recordsError) throw recordsError;
      }

      // Navigate to the self-summary page instead of the regular summary page
      router.replace(`/attendance/${id}/self-summary?sessionId=${sessionId}`);
    } catch (error) {
      console.error('Error ending session:', error);
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStudent = ({ item }: { item: Student }) => {
    const isCurrentUser = item.id === currentUserId;
    
    return (
      <View style={styles.studentCard}>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{item.name} {isCurrentUser ? '(You)' : ''}</Text>
          <Text style={styles.rollNumber}>Roll No: {item.roll_number}</Text>
        </View>
        <View style={styles.statusContainer}>
          {item.attendance_status ? (
            <View style={[
              styles.statusTag,
              item.attendance_status === 'present' ? styles.presentTag : styles.absentTag,
            ]}>
              <Text style={[
                styles.statusText,
                item.attendance_status === 'present' ? styles.presentText : styles.absentText,
              ]}>
                {item.attendance_status === 'present' ? 'Present' : 'Absent'}
              </Text>
            </View>
          ) : isCurrentUser ? (
            <View style={styles.markButtonsContainer}>
              <TouchableOpacity 
                style={[styles.markButton, styles.presentButton]}
                onPress={() => markMyAttendance('present')}
                disabled={markingAttendance}
              >
                <Check size={16} color="#FFFFFF" />
                <Text style={styles.markButtonText}>Present</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.markButton, styles.absentButton]}
                onPress={() => markMyAttendance('absent')}
                disabled={markingAttendance}
              >
                <X size={16} color="#FFFFFF" />
                <Text style={styles.markButtonText}>Absent</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.pendingTag}>
              <Text style={styles.pendingText}>Pending</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const markMyAttendance = async (status: 'present' | 'absent') => {
    if (!currentUserId || markingAttendance) return;
    
    try {
      setMarkingAttendance(true);
      
      // Check if already marked
      const { data: existingRecord } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('session_id', sessionId)
        .eq('student_id', currentUserId)
        .single();
        
      if (existingRecord) {
        Alert.alert('Already Marked', 'You have already marked your attendance for this session.');
        return;
      }
      
      // Optimistically update the UI
      setStudents(currentStudents => 
        currentStudents.map(student => 
          student.id === currentUserId 
            ? { ...student, attendance_status: status } 
            : student
        )
      );
      
      // Create attendance record
      const { error: recordError } = await supabase
        .from('attendance_records')
        .insert({
          session_id: sessionId,
          student_id: currentUserId,
          status: status,
          marked_by: currentUserId, // Self-marked
        });
        
      if (recordError) {
        // Revert optimistic update if there was an error
        setStudents(currentStudents => 
          currentStudents.map(student => 
            student.id === currentUserId 
              ? { ...student, attendance_status: null } 
              : student
          )
        );
        throw recordError;
      }
      
      Alert.alert('Success', `Your attendance has been marked as ${status}!`);
      
      // Force refresh to ensure data is up to date
      fetchStudents();
      
    } catch (error) {
      console.error('Error marking attendance:', error);
      Alert.alert('Error', 'Failed to mark attendance. Please try again.');
    } finally {
      setMarkingAttendance(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Self Attendance Session</Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {students.filter(s => s.attendance_status === 'present').length}
          </Text>
          <Text style={styles.statLabel}>Present</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {students.filter(s => s.attendance_status === 'absent').length}
          </Text>
          <Text style={styles.statLabel}>Absent</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {students.filter(s => !s.attendance_status).length}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      <FlatList
        data={students}
        renderItem={renderStudent}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#1E40AF"]}
            tintColor="#1E40AF"
          />
        }
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.endButton, submitting && styles.endButtonDisabled]}
          onPress={() => {
            Alert.alert(
              'End Session',
              'Are you sure you want to end this session? All unmarked students will be marked as absent.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'End Session', onPress: endSession },
              ]
            );
          }}
          disabled={submitting}
        >
          <Text style={styles.endButtonText}>
            {submitting ? 'Ending Session...' : 'End Session'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Add these new styles
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  rotating: {
    opacity: 0.5,
  },
  // Keep your existing styles
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
  },
  stats: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginTop: 1,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  studentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  rollNumber: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusContainer: {
    minWidth: 80,
  },
  statusTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  presentTag: {
    backgroundColor: '#ECFDF5',
  },
  absentTag: {
    backgroundColor: '#FEF2F2',
  },
  pendingTag: {
    backgroundColor: '#F3F4F6',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  presentText: {
    color: '#059669',
  },
  absentText: {
    color: '#DC2626',
  },
  pendingText: {
    color: '#6B7280',
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  endButton: {
    backgroundColor: '#DC2626',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  endButtonDisabled: {
    opacity: 0.7,
  },
  endButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#DC2626',
    padding: 20,
    textAlign: 'center',
  },
  markButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  markButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  presentButton: {
    backgroundColor: '#059669',
  },
  absentButton: {
    backgroundColor: '#DC2626',
  },
  markButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});