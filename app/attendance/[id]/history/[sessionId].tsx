import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Check, X } from 'lucide-react-native';

interface AttendanceRecord {
  id: string;
  student: {
    name: string;
    roll_number: string;
  };
  status: 'present' | 'absent' | 'penalty';
  marked_by: {
    name: string;
  };
  marked_at: string;
}

interface SessionDetails {
  date: string;
  type: 'manual' | 'self';
  group: {
    name: string;
  };
}

export default function SessionDetailsScreen() {
  const { id, sessionId } = useLocalSearchParams();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [session, setSession] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    absent: 0,
    penalty: 0,
  });

  useEffect(() => {
    fetchSessionDetails();
  }, [sessionId]);

  const fetchSessionDetails = async () => {
    try {
      // Get session details
      const { data: session, error: sessionError } = await supabase
        .from('attendance_sessions')
        .select(`
          date,
          type,
          group:groups(name)
        `)
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;
      setSession(session);

      // Get attendance records
      const { data: records, error: recordsError } = await supabase
        .from('attendance_records')
        .select(`
          id,
          status,
          marked_at,
          student:profiles!student_id(
            name,
            roll_number
          ),
          marker:profiles!marked_by(
            name
          )
        `)
        .eq('session_id', sessionId)
        .order('marked_at', { ascending: true });

      if (recordsError) throw recordsError;

      setRecords(records || []);

      // Calculate stats
      const total = records?.length || 0;
      const present = records?.filter(r => r.status === 'present').length || 0;
      const absent = records?.filter(r => r.status === 'absent').length || 0;
      const penalty = records?.filter(r => r.status === 'penalty').length || 0;

      setStats({ total, present, absent, penalty });
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderRecord = ({ item }: { item: AttendanceRecord }) => (
    <View style={styles.recordCard}>
      <View style={styles.studentInfo}>
        <Text style={styles.studentName}>{item.student.name}</Text>
        <Text style={styles.rollNumber}>Roll No: {item.student.roll_number}</Text>
      </View>
      <View style={[
        styles.statusTag,
        item.status === 'present' ? styles.presentTag : 
        item.status === 'absent' ? styles.absentTag : 
        styles.penaltyTag
      ]}>
        {item.status === 'present' ? (
          <Check size={16} color="#059669" />
        ) : (
          <X size={16} color="#DC2626" />
        )}
        <Text style={[
          styles.statusText,
          item.status === 'present' ? styles.presentText :
          item.status === 'absent' ? styles.absentText :
          styles.penaltyText
        ]}>
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </Text>
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

  if (error || !session) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Session not found'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Attendance Details</Text>
        <Text style={styles.subtitle}>{session.group.name}</Text>
        <Text style={styles.date}>
          {new Date(session.date).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, styles.presentValue]}>
            {stats.present}
          </Text>
          <Text style={styles.statLabel}>Present</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, styles.absentValue]}>
            {stats.absent}
          </Text>
          <Text style={styles.statLabel}>Absent</Text>
        </View>
        {stats.penalty > 0 && (
          <View style={styles.statItem}>
            <Text style={[styles.statValue, styles.penaltyValue]}>
              {stats.penalty}
            </Text>
            <Text style={styles.statLabel}>Penalty</Text>
          </View>
        )}
      </View>

      <FlatList
        data={records}
        renderItem={renderRecord}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    color: '#4B5563',
    marginBottom: 4,
  },
  date: {
    fontSize: 16,
    color: '#6B7280',
  },
  stats: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginTop: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
  presentValue: {
    color: '#059669',
  },
  absentValue: {
    color: '#DC2626',
  },
  penaltyValue: {
    color: '#D97706',
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
  recordCard: {
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
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  presentTag: {
    backgroundColor: '#ECFDF5',
  },
  absentTag: {
    backgroundColor: '#FEF2F2',
  },
  penaltyTag: {
    backgroundColor: '#FEF3C7',
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
  penaltyText: {
    color: '#D97706',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
  },
});