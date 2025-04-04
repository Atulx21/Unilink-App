import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Check, X, Search, ArrowLeft } from 'lucide-react-native';

interface Student {
  id: string;
  name: string;
  roll_number: string;
  attendance_status: 'present' | 'absent' | null;
}

export default function ManualAttendanceScreen() {
  const { id } = useLocalSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    absent: 0,
    unmarked: 0
  });

  useEffect(() => {
    fetchStudents();
  }, [id]);

  useEffect(() => {
    // Filter students based on search query
    if (searchQuery.trim() === '') {
      setFilteredStudents(students);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredStudents(
        students.filter(
          student => 
            student.name.toLowerCase().includes(query) || 
            student.roll_number.toLowerCase().includes(query)
        )
      );
    }
    
    // Update stats
    updateStats();
  }, [students, searchQuery]);

  const updateStats = () => {
    const present = students.filter(s => s.attendance_status === 'present').length;
    const absent = students.filter(s => s.attendance_status === 'absent').length;
    const total = students.length;
    
    setStats({
      total,
      present,
      absent,
      unmarked: total - present - absent
    });
  };

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
        roll_number: member.profiles.roll_number || 'N/A',
        attendance_status: null,
      }));

      setStudents(formattedStudents);
      setFilteredStudents(formattedStudents);
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

  const markAllPresent = () => {
    Alert.alert(
      'Mark All Present',
      'Are you sure you want to mark all students as present?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          onPress: () => {
            setStudents(current =>
              current.map(student => ({ ...student, attendance_status: 'present' }))
            );
          }
        },
      ]
    );
  };

  const handleSubmit = async () => {
    // Check if all students have been marked
    const unmarkedCount = students.filter(s => s.attendance_status === null).length;
    
    if (unmarkedCount > 0) {
      Alert.alert(
        'Unmarked Students',
        `${unmarkedCount} students haven't been marked. Do you want to continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: submitAttendance }
        ]
      );
    } else {
      submitAttendance();
    }
  };

  const submitAttendance = async () => {
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

      Alert.alert(
        'Success',
        'Attendance has been recorded successfully',
        [{ text: 'OK', onPress: () => router.replace(`/attendance/${id}`) }]
      );
    } catch (error) {
      setError(error.message);
      Alert.alert('Error', error.message);
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
            item.attendance_status === 'absent' && styles.activeAbsentButton,
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
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.title}>Manual Attendance</Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.error}>{error}</Text>
        </View>
      )}

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={20} color="#6B7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or roll number"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#059669' }]}>{stats.present}</Text>
          <Text style={styles.statLabel}>Present</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#DC2626' }]}>{stats.absent}</Text>
          <Text style={styles.statLabel}>Absent</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#9CA3AF' }]}>{stats.unmarked}</Text>
          <Text style={styles.statLabel}>Unmarked</Text>
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={styles.markAllButton}
          onPress={markAllPresent}
        >
          <Text style={styles.markAllButtonText}>Mark All Present</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredStudents}
        renderItem={renderStudent}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    margin: 16,
    borderRadius: 8,
  },
  error: {
    color: '#DC2626',
    fontSize: 14,
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#1F2937',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 8,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  actionsContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  markAllButton: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  markAllButtonText: {
    color: '#1E40AF',
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingTop: 8,
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
    marginBottom: 12,
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
  activeAbsentButton: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
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