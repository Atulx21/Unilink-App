import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Check, X } from 'lucide-react-native';

interface Student {
  id: string;
  name: string;
  roll_number: string;
  attendance_status: 'present' | 'absent' | null;
}

export default function ManualAttendanceScreen() {
  const { id } = useLocalSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, [id]);

  const fetchStudents = async () => {
    try {
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

      const formattedStudents = members.map(member => ({
        id: member.profiles.id,
        name: member.profiles.name,
        roll_number: member.profiles.roll_number,
        attendance_status: null,
      }));

      setStudents(formattedStudents);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const markAttendance = (studentId: string, status: 'present' | 'absent') => {
    setStudents(current =>
      current.map(student =>
        student.id === studentId
          ? { ...student, attendance_status: status }
          : student
      )
    );
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      
      // Create attendance session
      const { data: session, error: sessionError } = await supabase
        .from('attendance_sessions')
        .insert({
          group_id: id,
          type: 'manual',
          status: 'completed',
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Get marker's profile ID
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      // Create attendance records
      const records = students
        .filter(student => student.attendance_status)
        .map(student => ({
          session_id: session.id,
          student_id: student.id,
          status: student.attendance_status,
          marked_by: profile.id,
        }));

      const { error: recordsError } = await supabase
        .from('attendance_records')
        .insert(records);

      if (recordsError) throw recordsError;

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
      <View style={styles.attendanceActions}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.presentButton,
            item.attendance_status === 'present' && styles.activeButton,
          ]}
          onPress={() => markAttendance(item.id, 'present')}
        >
          <Check size={20} color={item.attendance_status === 'present' ? '#FFFFFF' : '#059669'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.absentButton,
            item.attendance_status === 'absent' && styles.activeButton,
          ]}
          onPress={() => markAttendance(item.id, 'absent')}
        >
          <X size={20} color={item.attendance_status === 'absent' ? '#FFFFFF' : '#DC2626'} />
        </TouchableOpacity>
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
        <Text style={styles.title}>Manual Attendance</Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={students}
        renderItem={renderStudent}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting || students.some(s => s.attendance_status === null)}
        >
          <Text style={styles.submitButtonText}>
            {submitting ? 'Submitting...' : 'Submit Attendance'}
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
  error: {
    color: '#DC2626',
    padding: 20,
    textAlign: 'center',
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
  attendanceActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  presentButton: {
    borderColor: '#059669',
  },
  absentButton: {
    borderColor: '#DC2626',
  },
  activeButton: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  submitButton: {
    backgroundColor: '#1E40AF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});