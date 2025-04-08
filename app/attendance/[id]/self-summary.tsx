import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Check, X, TriangleAlert as AlertTriangle, ArrowLeft } from 'lucide-react-native';

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

export default function SelfAttendanceSummaryScreen() {
  const { id, sessionId } = useLocalSearchParams();
  const [stats, setStats] = useState<AttendanceStats>({
    present: [],
    absent: [],
    penalty: [],
  });
  const [selectedCategory, setSelectedCategory] = useState<'present' | 'absent' | 'penalty'>('present');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<{
    date: string;
    type: string;
    groupName: string;
  } | null>(null);

  useEffect(() => {
    loadAttendanceData();
  }, []);

  const loadAttendanceData = async () => {
    try {
      setLoading(true);
      
      // Get session info
      const { data: session, error: sessionError } = await supabase
        .from('attendance_sessions')
        .select(`
          date,
          type,
          groups(name)
        `)
        .eq('id', sessionId)
        .single();
        
      if (sessionError) throw sessionError;
      
      setSessionInfo({
        date: new Date(session.date).toLocaleDateString(),
        type: session.type === 'manual' ? 'Manual' : 'Self',
        groupName: session.groups.name
      });

      // Get attendance records
      const { data: records, error: recordsError } = await supabase
        .from('attendance_records')
        .select(`
          student:profiles!attendance_records_student_id_fkey(
            id,
            name,
            roll_number
          ),
          status
        `)
        .eq('session_id', sessionId)
        .order('status');

      if (recordsError) throw recordsError;

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
            roll_number: record.student.roll_number || 'N/A',
            attendance_status: record.status,
          };

          groupedStats[record.status].push(student);
        });

        // Sort each category by roll number
        const sortByRollNumber = (a: Student, b: Student) => {
          const rollA = a.roll_number || 'N/A';
          const rollB = b.roll_number || 'N/A';
          return rollA.localeCompare(rollB, undefined, { numeric: true });
        };

        groupedStats.present.sort(sortByRollNumber);
        groupedStats.absent.sort(sortByRollNumber);
        groupedStats.penalty.sort(sortByRollNumber);

        setStats(groupedStats);
      }
    } catch (error) {
      console.error('Error loading attendance data:', error);
      setError('Failed to load attendance data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const markAsPenalty = async (studentId: string) => {
    try {
      // Update the student's attendance status to penalty
      const { error: updateError } = await supabase
        .from('attendance_records')
        .update({ status: 'penalty' })
        .eq('session_id', sessionId)
        .eq('student_id', studentId);
        
      if (updateError) throw updateError;
      
      // Refresh the data
      await loadAttendanceData();
      
      Alert.alert('Success', 'Student marked as penalty');
    } catch (error) {
      console.error('Error marking penalty:', error);
      Alert.alert('Error', 'Failed to mark student as penalty');
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
      const { error: updateError } = await supabase
        .from('attendance_sessions')
        .update({ status: 'completed' })
        .eq('id', sessionId);
        
      if (updateError) throw updateError;
      
      Alert.alert(
        'Success',
        'Attendance has been finalized successfully',
        [{ text: 'OK', onPress: () => router.replace(`/attendance/${id}`) }]
      );
    } catch (error) {
      console.error('Error finalizing attendance:', error);
      Alert.alert('Error', 'Failed to finalize attendance. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStudent = ({ item }: { item: Student }) => (
    <View style={styles.studentCard}>
      <View style={styles.studentInfo}>
        <Text style={styles.studentName}>{item.profile?.name || item.name}</Text>
        <Text style={styles.rollNumber}>Roll No: {item.profile?.roll_number || item.roll_number}</Text>
      </View>
      <View style={styles.statusIndicator}>
        {item.attendance_status === 'present' && (
          <View style={styles.actionContainer}>
            <View style={[styles.statusBadge, styles.presentBadge]}>
              <Check size={16} color="#FFFFFF" />
              <Text style={styles.statusText}>Present</Text>
            </View>
            <TouchableOpacity 
              style={styles.penaltyButton}
              onPress={() => markAsPenalty(item.id)}
            >
              <AlertTriangle size={14} color="#D97706" />
              <Text style={styles.penaltyButtonText}>Mark Penalty</Text>
            </TouchableOpacity>
          </View>
        )}
        {item.attendance_status === 'absent' && (
          <View style={[styles.statusBadge, styles.absentBadge]}>
            <X size={16} color="#FFFFFF" />
            <Text style={styles.statusText}>Absent</Text>
          </View>
        )}
        {item.attendance_status === 'penalty' && (
          <View style={[styles.statusBadge, styles.penaltyBadge]}>
            <AlertTriangle size={16} color="#FFFFFF" />
            <Text style={styles.statusText}>Penalty</Text>
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
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.title}>Attendance Summary</Text>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <AlertTriangle size={20} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <>
          {sessionInfo && (
            <View style={styles.sessionInfoCard}>
              <Text style={styles.groupName}>{sessionInfo.groupName}</Text>
              <View style={styles.sessionDetails}>
                <Text style={styles.sessionDate}>{sessionInfo.date}</Text>
                <Text style={styles.sessionType}>{sessionInfo.type} Attendance</Text>
              </View>
            </View>
          )}

          <View style={styles.statsOverview}>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, styles.presentIcon]}>
                <Check size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.statCount}>{stats.present.length}</Text>
              <Text style={styles.statLabel}>Present</Text>
            </View>
            
            <View style={styles.statItem}>
              <View style={[styles.statIcon, styles.absentIcon]}>
                <X size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.statCount}>{stats.absent.length}</Text>
              <Text style={styles.statLabel}>Absent</Text>
            </View>
            
            <View style={styles.statItem}>
              <View style={[styles.statIcon, styles.penaltyIcon]}>
                <AlertTriangle size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.statCount}>{stats.penalty.length}</Text>
              <Text style={styles.statLabel}>Penalty</Text>
            </View>
          </View>

          <View style={styles.categorySelector}>
            <TouchableOpacity
              style={[
                styles.categoryTab,
                selectedCategory === 'present' && styles.activeTab,
              ]}
              onPress={() => setSelectedCategory('present')}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === 'present' && styles.activeText,
                ]}
              >
                Present ({stats.present.length})
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.categoryTab,
                selectedCategory === 'absent' && styles.activeTab,
              ]}
              onPress={() => setSelectedCategory('absent')}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === 'absent' && styles.activeText,
                ]}
              >
                Absent ({stats.absent.length})
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.categoryTab,
                selectedCategory === 'penalty' && styles.activeTab,
              ]}
              onPress={() => setSelectedCategory('penalty')}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === 'penalty' && styles.activeText,
                ]}
              >
                Penalty ({stats.penalty.length})
              </Text>
            </TouchableOpacity>
          </View>

          {stats[selectedCategory].length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No students in this category</Text>
            </View>
          ) : (
            <FlatList
              data={stats[selectedCategory]}
              renderItem={renderStudent}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
            />
          )}

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Finalize Attendance</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    marginRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  errorContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  sessionInfoCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  sessionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sessionDate: {
    fontSize: 14,
    color: '#4B5563',
  },
  sessionType: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  statsOverview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  presentIcon: {
    backgroundColor: '#059669',
  },
  absentIcon: {
    backgroundColor: '#DC2626',
  },
  penaltyIcon: {
    backgroundColor: '#D97706',
  },
  statCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  categorySelector: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  categoryTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#1E40AF',
  },
  categoryText: {
    fontSize: 14,
    color: '#6B7280',
  },
  activeText: {
    color: '#1E40AF',
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100, // Extra padding for the submit button
  },
  studentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
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
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  presentBadge: {
    backgroundColor: '#059669',
  },
  absentBadge: {
    backgroundColor: '#DC2626',
  },
  penaltyBadge: {
    backgroundColor: '#D97706',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  penaltyButton: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D97706',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  penaltyButtonText: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  submitButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});