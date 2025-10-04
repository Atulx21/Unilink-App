import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { CheckCircle, X, AlertTriangle, Calendar, ArrowLeft, Clock } from 'lucide-react-native';

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
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    fetchAttendanceHistory();
    fetchGroupName();
  }, [id]);

  const fetchGroupName = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('name')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      setGroupName(data.name);
    } catch (error) {
      console.error('Error fetching group name:', error);
    }
  };

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
          created_at
        `)
        .eq('student_id', profile.id)
        .order('created_at', { ascending: false });
      
      if (recordsError) throw recordsError;
      
      // Get the session details for each record
      const sessionIds = records?.map(record => record.session_id) || [];
      
      if (sessionIds.length > 0) {
        const { data: sessions, error: sessionsError } = await supabase
          .from('attendance_sessions')
          .select(`
            id,
            date,
            type,
            group_id
          `)
          .in('id', sessionIds);
        
        if (sessionsError) throw sessionsError;
        
        // Filter sessions to only include those from the current group
        const groupSessions = sessions.filter(session => session.group_id === id);
        
        // Create a map of session details
        const sessionMap = new Map(groupSessions.map(session => [session.id, session]));
        
        // Combine the records with session details, filtering out records not in this group
        const formattedRecords = records
          .filter(record => sessionMap.has(record.session_id))
          .map(record => ({
            ...record,
            marked_at: record.created_at,
            session: {
              date: sessionMap.get(record.session_id)?.date || '',
              type: sessionMap.get(record.session_id)?.type || 'manual'
            }
          }));
        
        setRecords(formattedRecords);
        
        // Calculate stats
        const total = formattedRecords.length || 0;
        const present = formattedRecords.filter(r => r.status === 'present').length || 0;
        const absent = formattedRecords.filter(r => r.status === 'absent').length || 0;
        const penalty = formattedRecords.filter(r => r.status === 'penalty').length || 0;
        const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
        
        setStats({ total, present, absent, penalty, percentage });
      } else {
        setRecords([]);
        setStats({ total: 0, present: 0, absent: 0, penalty: 0, percentage: 0 });
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderRecord = ({ item }: { item: AttendanceRecord }) => (
    <View style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <View style={styles.dateContainer}>
          <Calendar size={16} color="#4B5563" style={styles.calendarIcon} />
          <Text style={styles.recordDate}>
            {formatDate(item.session.date)}
          </Text>
        </View>
        <View style={[
          styles.sessionTypeTag,
          item.session.type === 'manual' ? styles.manualTag : styles.selfTag
        ]}>
          <Text style={[
            styles.sessionTypeText,
            item.session.type === 'manual' ? styles.manualText : styles.selfText
          ]}>
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
            <X size={20} color="#DC2626" />
          ) : (
            <AlertTriangle size={20} color="#D97706" />
          )}
        </View>
        <View style={styles.statusDetails}>
          <Text style={styles.statusText}>
            {item.status === 'present' ? 'Present' : 
             item.status === 'absent' ? 'Absent' : 'Penalty'}
          </Text>
          <Text style={styles.markedTime}>
            {new Date(item.marked_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
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
        <Text style={styles.title}>My Attendance</Text>
      </View>

      <View style={styles.groupNameContainer}>
        <Text style={styles.groupName}>{groupName}</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.attendancePercentageContainer}>
          <View style={styles.percentageCircle}>
            <Text style={styles.percentageValue}>{stats.percentage}%</Text>
          </View>
          <Text style={styles.percentageLabel}>Attendance Rate</Text>
        </View>

        <View style={styles.statsDetails}>
          <View style={styles.statItem}>
            <View style={[styles.statIconBg, styles.presentBg]}>
              <CheckCircle size={16} color="#059669" />
            </View>
            <Text style={styles.statValue}>{stats.present}</Text>
            <Text style={styles.statLabel}>Present</Text>
          </View>
          
          <View style={styles.statItem}>
            <View style={[styles.statIconBg, styles.absentBg]}>
              <X size={16} color="#DC2626" />
            </View>
            <Text style={styles.statValue}>{stats.absent}</Text>
            <Text style={styles.statLabel}>Absent</Text>
          </View>
          
          <View style={styles.statItem}>
            <View style={[styles.statIconBg, styles.penaltyBg]}>
              <AlertTriangle size={16} color="#D97706" />
            </View>
            <Text style={styles.statValue}>{stats.penalty}</Text>
            <Text style={styles.statLabel}>Penalty</Text>
          </View>
        </View>
      </View>

      <View style={styles.historyContainer}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>Attendance History</Text>
          <Text style={styles.historyCount}>{records.length} sessions</Text>
        </View>

        {records.length > 0 ? (
          <FlatList
            data={records}
            renderItem={renderRecord}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Clock size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No attendance records found</Text>
          </View>
        )}
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
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
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
  groupNameContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  groupName: {
    fontSize: 16,
    color: '#4B5563',
    fontWeight: '500',
  },
  statsContainer: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  attendancePercentageContainer: {
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  percentageCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  percentageValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  percentageLabel: {
    fontSize: 14,
    color: '#4B5563',
  },
  statsDetails: {
    flexDirection: 'row',
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  presentBg: {
    backgroundColor: '#ECFDF5',
  },
  absentBg: {
    backgroundColor: '#FEF2F2',
  },
  penaltyBg: {
    backgroundColor: '#FFFBEB',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  historyContainer: {
    flex: 1,
    marginTop: 16,
    marginHorizontal: 16,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  historyCount: {
    fontSize: 14,
    color: '#6B7280',
  },
  list: {
    paddingBottom: 20,
  },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarIcon: {
    marginRight: 8,
  },
  recordDate: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
  },
  sessionTypeTag: {
    paddingHorizontal: 10,
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
  manualText: {
    color: '#1E40AF',
  },
  selfText: {
    color: '#059669',
  },
  recordContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  statusIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  presentIndicator: {
    backgroundColor: '#ECFDF5',
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
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  markedTime: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
  },
});