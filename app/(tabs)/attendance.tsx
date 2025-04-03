import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Users, Plus, History, RefreshCw } from 'lucide-react-native';

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

  useEffect(() => {
    fetchGroups();
  }, []);

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

  const onRefresh = () => {
    setRefreshing(true);
    fetchGroups();
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
        {userRole === 'teacher' && activeTab === 'groups' && (
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.push('/attendance/create')}
          >
            <Plus size={24} color="#FFFFFF" />
          </TouchableOpacity>
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
            {userRole === 'teacher' && (
              <TouchableOpacity
                style={styles.createFirstButton}
                onPress={() => router.push('/attendance/create')}
              >
                <Text style={styles.createFirstButtonText}>Create your first group</Text>
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
                  onPress={() => router.push(`/tracking/${item.id}`)}
                >
                  <Text style={styles.trackingGroupName}>{item.name}</Text>
                  <Text style={styles.trackingAttendance}>Attendance: Calculating...</Text>
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
});