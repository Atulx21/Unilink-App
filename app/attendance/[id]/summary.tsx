import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Check, X, TriangleAlert as AlertTriangle, Users, UserX, CircleAlert as AlertCircle, ArrowLeft } from 'lucide-react-native';

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

      // Get attendance records - FIX: Specify the relationship explicitly
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

        setStats(groupedStats);
      }
    } catch (error) {
      console.error('Error loading attendance data:', error);
      setError('Failed to load attendance data. Please try again.');
    } finally {
      setLoading(false);
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
        <Text style={styles.studentName}>{item.name}</Text>
        <Text style={styles.rollNumber}>Roll No: {item.roll_number}</Text>
      </View>
      <View style={styles.statusIndicator}>
        {item.attendance_status === 'present' && (
          <View style={[styles.statusBadge, styles.presentBadge]}>
            <Check size={16} color="#FFFFFF" />
            <Text style={styles.statusText}>Present</Text>
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

          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, selectedCategory === 'present' && styles.activeTab]}
              onPress={() => setSelectedCategory('present')}
            >
              <Text style={[styles.tabText, selectedCategory === 'present' && styles.activeTabText]}>
                Present ({stats.present.length})
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tab, selectedCategory === 'absent' && styles.activeTab]}
              onPress={() => setSelectedCategory('absent')}
            >
              <Text style={[styles.tabText, selectedCategory === 'absent' && styles.activeTabText]}>
                Absent ({stats.absent.length})
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tab, selectedCategory === 'penalty' && styles.activeTab]}
              onPress={() => setSelectedCategory('penalty')}
            >
              <Text style={[styles.tabText, selectedCategory === 'penalty' && styles.activeTabText]}>
                Penalty ({stats.penalty.length})
              </Text>
            </TouchableOpacity>
          </View>

          {stats[selectedCategory].length === 0 ? (
            <View style={styles.emptyState}>
              {selectedCategory === 'present' && (
                <>
                  <Users size={48} color="#9CA3AF" />
                  <Text style={styles.emptyStateText}>No students marked as present</Text>
                </>
              )}
              {selectedCategory === 'absent' && (
                <>
                  <UserX size={48} color="#9CA3AF" />
                  <Text style={styles.emptyStateText}>No students marked as absent</Text>
                </>
              )}
              {selectedCategory === 'penalty' && (
                <>
                  <AlertCircle size={48} color="#9CA3AF" />
                  <Text style={styles.emptyStateText}>No students with penalty</Text>
                </>
              )}
            </View>
          ) : (
            <FlatList
              data={stats[selectedCategory]}
              renderItem={renderStudent}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitButtonText}>
            {submitting ? 'Finalizing...' : 'Finalize Attendance'}
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
    margin: 16,
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    color: '#DC2626',
    marginLeft: 8,
    flex: 1,
  },
  sessionInfoCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
    color: '#6B7280',
    fontSize: 14,
  },
  sessionType: {
    color: '#6B7280',
    fontSize: 14,
  },
  statsOverview: {
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
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    backgroundColor: '#F59E0B',
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#1E40AF',
  },
  tabText: {
    color: '#6B7280',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#1E40AF',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
    textAlign: 'center',
  },
  list: {
    padding: 16,
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
  statusIndicator: {
    marginLeft: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  presentBadge: {
    backgroundColor: '#059669',
  },
  absentBadge: {
    backgroundColor: '#DC2626',
  },
  penaltyBadge: {
    backgroundColor: '#F59E0B',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
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