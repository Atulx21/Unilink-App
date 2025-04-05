import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle } from 'lucide-react-native';

interface AttendanceRecord {
  id: string;
  session_id: string;
  status: 'present' | 'absent' | 'penalty';
  marked_at: string;
  session: {
    date: string;
    type: 'manual' | 'self';
  };
}

export default function StudentHistoryScreen() {
  const { id } = useLocalSearchParams();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    absent: 0,
    penalty: 0,
    percentage: 0,
  });

  useEffect(() => {
    fetchAttendanceHistory();
  }, [id]);

  const fetchAttendanceHistory = async () => {
    try {
      setLoading(true);
      
      // Get current user's profile ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      // Get attendance records for this student in this group
      const { data: records, error: recordsError } = await supabase
        .from('attendance_records')
        .select(`
          id,
          session_id,
          status,
          created_at as marked_at,
          session:attendance_sessions(
            date,
            type
          )
        `)
        .eq('student_id', profile.id)
        .eq('session:attendance_sessions.group_id', id)
        .order('created_at', { ascending: false });
      
      if (recordsError) throw recordsError;
      
      setRecords(records || []);
      
      // Calculate stats
      const total = records?.length || 0;
      const present = records?.filter(r => r.status === 'present').length || 0;
      const absent = records?.filter(r => r.status === 'absent').length || 0;
      const penalty = records?.filter(r => r.status === 'penalty').length || 0;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
      
      setStats({ total, present, absent, penalty, percentage });
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderRecord = ({ item }: { item: AttendanceRecord }) => (
    <View style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <Text style={styles.recordDate}>
          {new Date(item.session.date).toLocaleDateString()}
        </Text>
        <View style={[
          styles.sessionTypeTag,
          item.session.type === 'manual' ? styles.manualTag : styles.selfTag
        ]}>
          <Text style={styles.sessionTypeText}>
            {item.session.type === 'manual' ? 'Manual' : 'Self'}
          </Text>
        </View>
      </View>
      
      <View style={styles.recordContent}>
        <View style={[
          styles.statusIndicator,
          item.status === 'present' ? styles.presentIndicator : 
          item.status === 'absent' ? styles.absentIndicator : styles.penaltyIndicator
        ]}>
          {item.status === 'present' ? (
            <CheckCircle size={20} color="#059669" />
          ) : item.status === 'absent' ? (
            <XCircle size={20} color="#DC2626" />
          ) : (
            <AlertTriangle size={20} color="#D97706" />
          )}
        </View>
        
        <View style={styles.statusDetails}>
          <Text style={[
            styles.statusText,
            item.status === 'present' ? styles.presentText : 
            item.status === 'absent' ? styles.absentText : styles.penaltyText
          ]}>
            {item.status === 'present' ? 'Present' : 
             item.status === 'absent' ? 'Absent' : 'Penalty'}
          </Text>
          <Text style={styles.timeText}>
            {new Date(item.marked_at).toLocaleTimeString()}
          </Text>
        </View>
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
        <Text style={styles.title}>My Attendance History</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.percentage}%</Text>
          <Text style={styles.statLabel}>Attendance</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.present}</Text>
          <Text style={styles.statLabel}>Present</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.absent}</Text>
          <Text style={styles.statLabel}>Absent</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchAttendanceHistory}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={records}
        renderItem={renderRecord}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.recordsList}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No attendance records found</Text>
          </View>
        }
      />
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
    padding: 8,
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  recordsList: {
    padding: 16,
  },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recordDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  sessionTypeTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  manualTag: {
    backgroundColor: '#EFF6FF',
  },
  selfTag: {
    backgroundColor: '#F0FDF4',
  },
  sessionTypeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  recordContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  presentIndicator: {
    backgroundColor: '#F0FDF4',
  },
  absentIndicator: {
    backgroundColor: '#FEF2F2',
  },
  penaltyIndicator: {
    backgroundColor: '#FFFBEB',
  },
  statusDetails: {
    flex: 1,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  presentText: {
    color: '#059669',
  },
  absentText: {
    color: '#DC2626',
  },
  penaltyText: {
    color: '#D97706',
  },
  timeText: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  errorText: {
    color: '#DC2626',
    marginBottom: 8,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
});