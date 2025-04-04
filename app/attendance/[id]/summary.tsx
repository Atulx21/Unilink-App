import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Check, X, TriangleAlert as AlertTriangle, Users, UserX, CircleAlert as AlertCircle } from 'lucide-react-native';

interface Student {
  id: string;
  name: string;
  roll_number: string;
  attendance_status: 'present' | 'absent' | 'penalty';
}

interface AttendanceStats {
  present: Student[];
  absent: Student[];
  penalty: Student[];
}

export default function AttendanceSummaryScreen() {
  const { id, sessionId } = useLocalSearchParams();
  const [stats, setStats] = useState<AttendanceStats>({
    present: [],
    absent: [],
    penalty: [],
  });
  const [selectedCategory, setSelectedCategory] = useState<'present' | 'absent' | 'penalty' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAttendanceData();
  }, []);

  const loadAttendanceData = async () => {
    try {
      const { data: records } = await supabase
        .from('attendance_records')
        .select(`
          student:profiles(
            id,
            name,
            roll_number
          ),
          status
        `)
        .eq('session_id', sessionId)
        .order('status');

      if (records) {
        const groupedStats: AttendanceStats = {
          present: [],
          absent: [],
          penalty: [],
        };

        records.forEach(record => {
          const student = {
            id: record.student.id,
            name: record.student.name,
            roll_number: record.student.roll_number,
            attendance_status: record.status,
          };

          groupedStats[record.status].push(student);
        });

        setStats(groupedStats);
      }
    } catch (error) {
      console.error('Error loading attendance data:', error);
    }
  };

  const handleSubmit = () => {
    Alert.alert(
      'Confirm Submission',
      'Are you sure you want to finalize this attendance? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', onPress: finalizeAttendance },
      ]
    );
  };

  const finalizeAttendance = async () => {
    try {
      setSubmitting(true);

      // Update session status to completed
      const { error: sessionError } = await supabase
        .from('attendance_sessions')
        .update({ status: 'completed' })
        .eq('id', sessionId);

      if (sessionError) throw sessionError;

      router.replace(`/attendance/${id}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to submit attendance. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStudentItem = ({ item }: { item: Student }) => (
    <View style={styles.studentCard}>
      <Text style={styles.studentName}>{item.name}</Text>
      <Text style={styles.rollNumber}>Roll No: {item.roll_number}</Text>
    </View>
  );

  const renderCategoryCard = (
    title: string,
    count: number,
    type: 'present' | 'absent' | 'penalty',
    icon: React.ReactNode
  ) => (
    <TouchableOpacity
      style={[
        styles.categoryCard,
        selectedCategory === type && styles.selectedCard,
        type === 'present' && styles.presentCard,
        type === 'absent' && styles.absentCard,
        type === 'penalty' && styles.penaltyCard,
      ]}
      onPress={() => setSelectedCategory(selectedCategory === type ? null : type)}
    >
      {icon}
      <Text style={styles.categoryCount}>{count}</Text>
      <Text style={styles.categoryTitle}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Attendance Summary</Text>
      </View>

      <View style={styles.categories}>
        {renderCategoryCard(
          'Present',
          stats.present.length,
          'present',
          <Users size={24} color="#059669" />
        )}
        {renderCategoryCard(
          'Absent',
          stats.absent.length,
          'absent',
          <UserX size={24} color="#DC2626" />
        )}
        {renderCategoryCard(
          'Penalty',
          stats.penalty.length,
          'penalty',
          <AlertCircle size={24} color="#D97706" />
        )}
      </View>

      {selectedCategory && (
        <>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>
              {selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Students
            </Text>
            <Text style={styles.listCount}>
              {stats[selectedCategory].length} students
            </Text>
          </View>

          <FlatList
            data={stats[selectedCategory]}
            renderItem={renderStudentItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitButtonText}>
            {submitting ? 'Submitting...' : 'Finalize Attendance'}
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
  categories: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  categoryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
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
  selectedCard: {
    borderWidth: 2,
  },
  presentCard: {
    borderColor: '#059669',
  },
  absentCard: {
    borderColor: '#DC2626',
  },
  penaltyCard: {
    borderColor: '#D97706',
  },
  categoryCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginVertical: 8,
  },
  categoryTitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  listCount: {
    fontSize: 14,
    color: '#6B7280',
  },
  list: {
    padding: 16,
    gap: 12,
  },
  studentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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