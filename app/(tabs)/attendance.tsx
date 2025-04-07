import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Users, Plus, History, RefreshCw, UserPlus } from 'lucide-react-native';

// Define types if not already in @/types
interface Group {
  id: string;
  name: string;
  owner_id: string;
  member_count: number;
}

type UserRole = 'student' | 'teacher';
type AttendanceTab = 'groups' | 'tracking';

export default function AttendanceScreen() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [activeTab, setActiveTab] = useState<AttendanceTab>('groups');
  const [attendanceStats, setAttendanceStats] = useState<Record<string, {
    percentage: number;
    present: number;
    absent: number;
    total: number;
    loading: boolean;
  }>>({});

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    if (activeTab === 'tracking' && userRole === 'student' && groups.length > 0) {
      fetchAttendanceStats();
    }
  }, [activeTab, groups, userRole]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      setError(null);
  
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');
  
      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('user_id', user.id)
        .single();
  
      if (profileError) {
        console.error('Profile error:', profileError);
        throw profileError;
      }
  
      setUserRole(profile?.role);
  
      // Instead of using RPC, let's query the groups directly
      if (profile.role === 'teacher') {
        // For teachers, get groups they own
        const { data: teacherGroups, error: groupsError } = await supabase
          .from('groups')
          .select(`
            id, 
            name, 
            owner_id,
            member_count:group_members(count)
          `)
          .eq('owner_id', profile.id);
  
        if (groupsError) {
          console.error('Groups error:', groupsError);
          throw groupsError;
        }
  
        // Format the groups data
        const formattedGroups = teacherGroups.map(group => ({
          ...group,
          member_count: typeof group.member_count === 'object' ? 
            (group.member_count[0]?.count || 0) : 
            group.member_count
        }));
  
        setGroups(formattedGroups || []);
      } else {
        // For students, get groups they are members of
        const { data: studentGroups, error: groupsError } = await supabase
          .from('group_members')
          .select(`
            group:groups(
              id,
              name,
              owner_id,
              member_count:group_members(count)
            )
          `)
          .eq('member_id', profile.id);
  
        if (groupsError) {
          console.error('Groups error:', groupsError);
          throw groupsError;
        }
  
        // Format the groups data
        const formattedGroups = studentGroups
          .map(item => ({
            ...item.group,
            member_count: item.group.member_count[0]?.count || 0
          }))
          .filter(Boolean);
  
        setGroups(formattedGroups || []);
      }
    } catch (error: any) {
      console.error('Fetch error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAttendanceStats = async () => {
    try {
      // Get current user's profile ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      // Initialize stats with loading state
      const initialStats = groups.reduce((acc, group) => {
        acc[group.id] = { percentage: 0, present: 0, absent: 0, total: 0, loading: true };
        return acc;
      }, {} as Record<string, any>);
      
      setAttendanceStats(initialStats);
      
      // Fetch attendance records for each group
      for (const group of groups) {
        // Get attendance records for this student in this group
        // First, get all sessions for this group
        const { data: sessions, error: sessionsError } = await supabase
          .from('attendance_sessions')
          .select('id')
          .eq('group_id', group.id)
          .eq('status', 'completed');
        
        if (sessionsError) throw sessionsError;
        
        if (!sessions || sessions.length === 0) {
          // No sessions for this group yet
          setAttendanceStats(prev => ({
            ...prev,
            [group.id]: { percentage: 0, present: 0, absent: 0, total: 0, loading: false }
          }));
          continue;
        }
        
        // Get attendance records for these sessions
        const sessionIds = sessions.map(s => s.id);
        const { data: records, error: recordsError } = await supabase
          .from('attendance_records')
          .select('id, status, session_id')
          .eq('student_id', profile.id)
          .in('session_id', sessionIds);
        
        if (recordsError) throw recordsError;
        
        // Calculate stats
        const total = records?.length || 0;
        const present = records?.filter(r => r.status === 'present').length || 0;
        const absent = records?.filter(r => r.status === 'absent').length || 0;
        const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
        
        setAttendanceStats(prev => ({
          ...prev,
          [group.id]: { percentage, present, absent, total, loading: false }
        }));
      }
    } catch (error) {
      console.error('Error fetching attendance stats:', error);
      // Update all groups to show error state
      const errorStats = groups.reduce((acc, group) => {
        acc[group.id] = { percentage: 0, present: 0, absent: 0, total: 0, loading: false };
        return acc;
      }, {} as Record<string, any>);
      
      setAttendanceStats(errorStats);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchGroups();
    if (activeTab === 'tracking' && userRole === 'student') {
      fetchAttendanceStats();
    }
  };

  const renderGroup = ({ item }: { item: Group }) => (
    <TouchableOpacity
      style={styles.groupCard}
      onPress={() => router.push(`/attendance/${item.id}`)}
    >
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{item.name}</Text>
        <View style={styles.groupStats}>
          <Users size={16} color="#6B7280" />
          <Text style={styles.memberCount}>{item.member_count} members</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Attendance</Text>
        {activeTab === 'groups' && (
          userRole === 'teacher' ? (
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/attendance/create')}
            >
              <Plus size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.joinButton}
              onPress={() => router.push('/attendance/join')}
            >
              <UserPlus size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )
        )}
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'groups' && styles.activeTab]} 
          onPress={() => setActiveTab('groups')}
        >
          <Text style={[styles.tabText, activeTab === 'groups' && styles.activeTabText]}>
            Groups
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'tracking' && styles.activeTab]} 
          onPress={() => setActiveTab('tracking')}
        >
          <Text style={[styles.tabText, activeTab === 'tracking' && styles.activeTabText]}>
            Tracking
          </Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchGroups}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : activeTab === 'groups' ? (
        groups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Users size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No groups found</Text>
            {userRole === 'teacher' ? (
              <TouchableOpacity
                style={styles.createFirstButton}
                onPress={() => router.push('/attendance/create')}
              >
                <Text style={styles.createFirstButtonText}>Create your first group</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.joinFirstButton}
                onPress={() => router.push('/attendance/join')}
              >
                <Text style={styles.joinFirstButtonText}>Join a group with code</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={groups}
            renderItem={renderGroup}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#1E40AF"]}
              />
            }
          />
        )
      ) : (
        <View style={styles.trackingContainer}>
          {userRole === 'student' ? (
            <FlatList
              data={groups}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.trackingCard}
                  onPress={() => router.push(`/attendance/${item.id}/student-history`)}
                >
                  <Text style={styles.trackingGroupName}>{item.name}</Text>
                  
                  {attendanceStats[item.id]?.loading ? (
                    <View style={styles.attendanceLoadingContainer}>
                      <ActivityIndicator size="small" color="#1E40AF" />
                      <Text style={styles.trackingAttendance}>Calculating...</Text>
                    </View>
                  ) : (
                    <View style={styles.attendanceStatsContainer}>
                      <View style={styles.percentageContainer}>
                        <Text style={[
                          styles.percentageText,
                          attendanceStats[item.id]?.percentage >= 75 ? styles.goodAttendance :
                          attendanceStats[item.id]?.percentage >= 60 ? styles.warningAttendance :
                          styles.poorAttendance
                        ]}>
                          {attendanceStats[item.id]?.percentage}%
                        </Text>
                      </View>
                      <View style={styles.attendanceDetailsContainer}>
                        <Text style={styles.trackingAttendance}>
                          Present: {attendanceStats[item.id]?.present} | Absent: {attendanceStats[item.id]?.absent} | Total: {attendanceStats[item.id]?.total}
                        </Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={["#1E40AF"]}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>You are not a member of any groups</Text>
                </View>
              }
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Tracking is available for students only</Text>
            </View>
          )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    elevation: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  createButton: {
    backgroundColor: '#1E40AF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    elevation: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#1E40AF',
  },
  tabText: {
    fontSize: 16,
    color: '#6B7280',
  },
  activeTabText: {
    color: '#1E40AF',
    fontWeight: '600',
  },
  list: {
    padding: 16,
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  groupStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberCount: {
    fontSize: 14,
    color: '#6B7280',
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
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 2,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
    marginBottom: 24,
    textAlign: 'center',
  },
  createFirstButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 2,
  },
  createFirstButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  trackingContainer: {
    flex: 1,
  },
  trackingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  trackingGroupName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  trackingAttendance: {
    fontSize: 14,
    color: '#6B7280',
  },
  joinButton: {
    backgroundColor: '#10B981', // Green color for join button
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  
  joinFirstButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 2,
  },
  
  joinFirstButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  trackingGroupName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  trackingAttendance: {
    fontSize: 14,
    color: '#6B7280',
  },
  attendanceLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  attendanceStatsContainer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  percentageContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 12,
  },
  percentageText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  goodAttendance: {
    color: '#059669', // Green
  },
  warningAttendance: {
    color: '#D97706', // Amber
  },
  poorAttendance: {
    color: '#DC2626', // Red
  },
  attendanceDetailsContainer: {
    flex: 1,
  },
  trackingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  trackingGroupName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  trackingAttendance: {
    fontSize: 14,
    color: '#6B7280',
  },
});