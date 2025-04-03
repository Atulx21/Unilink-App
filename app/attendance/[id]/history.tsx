import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Dimensions } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Calendar, Users, Clock, ChevronRight, ChevronLeft, Check, X } from 'lucide-react-native';

interface AttendanceSession {
  id: string;
  date: string;
  type: 'manual' | 'self';
  present_count: number;
  absent_count: number;
  penalty_count: number;
  total_students: number;
}

export default function AttendanceHistoryScreen() {
  const { id } = useLocalSearchParams();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalSessions: 0,
    averageAttendance: 0,
    totalStudents: 0,
  });

  useEffect(() => {
    fetchHistory();
  }, [id]);

  const fetchHistory = async () => {
    try {
      // Get all sessions with attendance counts
      const { data: sessions, error: sessionsError } = await supabase
        .from('attendance_sessions')
        .select(`
          id,
          date,
          type,
          present_count:attendance_records(count)
        `)
        .eq('group_id', id)
        .eq('status', 'completed')
        .order('date', { ascending: false });

      if (sessionsError) throw sessionsError;

      // Get total students in group
      const { data: members, error: membersError } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', id)
        .eq('role', 'student');

      if (membersError) throw membersError;

      const totalStudents = members?.length || 0;

      // Calculate overall stats
      const totalSessions = sessions?.length || 0;
      const averageAttendance = totalSessions > 0
        ? (sessions?.reduce((acc, session) => {
            // Handle the case where present_count might be an object with count property
            const presentCount = typeof session.present_count === 'object' 
              ? session.present_count[0]?.count || 0 
              : session.present_count || 0;
            return acc + presentCount;
          }, 0) / (totalSessions * totalStudents)) * 100
        : 0;

      setStats({
        totalSessions,
        averageAttendance,
        totalStudents,
      });

      setSessions(sessions || []);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
  };

  const renderSession = ({ item }: { item: AttendanceSession }) => {
    // Handle the case where present_count might be an object with count property
    const presentCount = typeof item.present_count === 'object' 
      ? item.present_count[0]?.count || 0 
      : item.present_count || 0;
    
    const attendancePercentage = stats.totalStudents > 0 
      ? ((presentCount / stats.totalStudents) * 100).toFixed(1) 
      : '0.0';
    
    const absentCount = stats.totalStudents - presentCount;

    return (
      <TouchableOpacity
        style={styles.sessionCard}
        onPress={() => router.push(`/attendance/${id}/history/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.sessionCardContent}>
          <View style={styles.sessionHeader}>
            <View style={styles.dateContainer}>
              <Calendar size={18} color="#4B5563" style={styles.icon} />
              <Text style={styles.date}>
                {formatDate(item.date)}
              </Text>
            </View>
            <View style={[
              styles.typeTag,
              item.type === 'manual' ? styles.manualTag : styles.selfTag,
            ]}>
              <Text style={[
                styles.typeText,
                item.type === 'manual' ? styles.manualText : styles.selfText,
              ]}>
                {item.type === 'manual' ? 'Manual' : 'Self'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <View style={[styles.statIconBg, styles.attendanceBg]}>
                  <Clock size={14} color="#1E40AF" />
                </View>
              </View>
              <Text style={styles.statValue}>
                {attendancePercentage}%
              </Text>
              <Text style={styles.statLabel}>Attendance</Text>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <View style={[styles.statIconBg, styles.presentBg]}>
                  <Check size={14} color="#059669" />
                </View>
              </View>
              <Text style={styles.statValue}>{presentCount}</Text>
              <Text style={styles.statLabel}>Present</Text>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <View style={[styles.statIconBg, styles.absentBg]}>
                  <X size={14} color="#DC2626" />
                </View>
              </View>
              <Text style={styles.statValue}>{absentCount}</Text>
              <Text style={styles.statLabel}>Absent</Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <Text style={styles.viewDetailsText}>View Details</Text>
            <ChevronRight size={16} color="#6B7280" />
          </View>
        </View>
      </TouchableOpacity>
    );
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
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.title}>Attendance History</Text>
        </View>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.statsCardContainer}>
        <View style={styles.statsCard}>
          <View style={styles.overallStatItem}>
            <View style={[styles.overallStatIconBg, styles.studentsIconBg]}>
              <Users size={20} color="#1E40AF" />
            </View>
            <Text style={styles.overallStatValue}>{stats.totalStudents}</Text>
            <Text style={styles.overallStatLabel}>Students</Text>
          </View>
          
          <View style={styles.overallStatDivider} />
          
          <View style={styles.overallStatItem}>
            <View style={[styles.overallStatIconBg, styles.sessionsIconBg]}>
              <Calendar size={20} color="#1E40AF" />
            </View>
            <Text style={styles.overallStatValue}>{stats.totalSessions}</Text>
            <Text style={styles.overallStatLabel}>Sessions</Text>
          </View>
          
          <View style={styles.overallStatDivider} />
          
          <View style={styles.overallStatItem}>
            <View style={[styles.overallStatIconBg, styles.averageIconBg]}>
              <Clock size={20} color="#1E40AF" />
            </View>
            <Text style={styles.overallStatValue}>
              {stats.averageAttendance.toFixed(1)}%
            </Text>
            <Text style={styles.overallStatLabel}>Average</Text>
          </View>
        </View>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Calendar size={64} color="#D1D5DB" />
          <Text style={styles.emptyText}>No attendance sessions found</Text>
          <Text style={styles.emptySubtext}>
            Start taking attendance to see history here
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          renderItem={renderSession}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const { width } = Dimensions.get('window');

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
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
  },
  statsCardContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  overallStatItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overallStatIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  studentsIconBg: {
    backgroundColor: '#EFF6FF',
  },
  sessionsIconBg: {
    backgroundColor: '#F0F9FF',
  },
  averageIconBg: {
    backgroundColor: '#F0FDFA',
  },
  overallStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  overallStatLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  overallStatDivider: {
    width: 1,
    height: '70%',
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
  },
  list: {
    padding: 16,
    paddingTop: 8,
  },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  sessionCardContent: {
    padding: 16,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 8,
  },
  date: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '600',
  },
  typeTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  manualTag: {
    backgroundColor: '#EFF6FF',
  },
  selfTag: {
    backgroundColor: '#F0F9FF',
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  manualText: {
    color: '#1E40AF',
  },
  selfText: {
    color: '#0369A1',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIconContainer: {
    marginBottom: 8,
  },
  statIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attendanceBg: {
    backgroundColor: '#EFF6FF',
  },
  presentBg: {
    backgroundColor: '#ECFDF5',
  },
  absentBg: {
    backgroundColor: '#FEF2F2',
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
  statDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  viewDetailsText: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
});