import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
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

  useEffect(() => {
    fetchStudents();
    const subscription = supabase
      .channel('attendance_records')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'attendance_records',
        filter: `session_id=eq.${sessionId}`,
      }, () => {
        fetchStudents();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [sessionId]);

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
        roll_number: member.profiles.roll_number,
        attendance_status: recordMap.get(member.profiles.id) || null,
      }));

      setStudents(formattedStudents);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const endSession = async () => {
    try {
      setSubmitting(true);

      // Mark all unmarked students as absent
      const unmarkedStudents = students
        .filter(student => !student.attendance_status)
        .map(student => ({
          session_id: sessionId,
          student_id: student.id,
          status: 'absent',
          marked_by: student.id, // Self-marked
        }));

      if (unmarkedStudents.length > 0) {
        const { error: recordsError } = await supabase
          .from('attendance_records')
          .insert(unmarkedStudents);

        if (recordsError) throw recordsError;
      }

      // Update session status to completed
      const { error: sessionError } = await supabase
        .from('attendance_sessions')
        .update({ status: 'completed' })
        .eq('id', sessionId);

      if (sessionError) throw sessionError;

      router.replace(`/attendance/${id}`);
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStudent = ({ item }: { item: Student }) => (
    <View style={styles.studentCard}>
      <View style={styles.studentInfo}>
        <Text style={styles.studentName}>{item.name}</Text>
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
        ) : (
          <View style={styles.pendingTag}>
            <Text style={styles.pendingText}>Pending</Text>
          </View>
        )}
      </View>
    </View>
  );

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
});