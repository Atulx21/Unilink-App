import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Users, Plus, BookOpen, School } from 'lucide-react-native';

// Define types
interface Group {
  id: string;
  name: string;
  subject: string;
  owner_id: string;
  member_count: number;
  type: string;
}

type UserRole = 'student' | 'teacher';

export default function AcademicScreen() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

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
  
      if (profile.role === 'teacher') {
        // For teachers, get groups they own
        const { data: teacherGroups, error: groupsError } = await supabase
          .from('groups')
          .select(`
            id, 
            name, 
            subject,
            owner_id,
            type,
            member_count:group_members(count)
          `)
          .eq('owner_id', profile.id)
          .eq('type', 'academic');
  
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
              subject,
              owner_id,
              type,
              member_count:group_members(count)
            )
          `)
          .eq('member_id', profile.id)
          .eq('groups.type', 'academic');
  
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
      onPress={() => router.push(`/academic/${item.id}`)}
    >
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{item.name}</Text>
        {item.subject && (
          <View style={styles.subjectContainer}>
            <School size={14} color="#4B5563" />
            <Text style={styles.subjectText}>{item.subject}</Text>
          </View>
        )}
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
        <View style={styles.titleContainer}>
          <Text style={styles.mainTitle}>Academic</Text>
          <Text style={styles.subtitle}>Groups</Text>
        </View>
        {userRole === 'teacher' && (
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.push('/academic/create')}
          >
            <Plus size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchGroups}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.emptyContainer}>
          <BookOpen size={48} color="#9CA3AF" />
          <Text style={styles.emptyText}>No academic groups found</Text>
          {userRole === 'teacher' ? (
            <TouchableOpacity
              style={styles.createFirstButton}
              onPress={() => router.push('/(app)/academic/create')}
            >
              <Text style={styles.createFirstButtonText}>Create your first academic group</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.joinFirstButton}
              
              onPress={() => router.push('/(app)/academic/join')}
            >
              <Text style={styles.joinFirstButtonText}>Join an academic group with code</Text>
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
      )}
    </View>
  );
}

// Updated styles
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
  titleContainer: {
    flexDirection: 'column',
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 18,
    color: '#4B5563',
    marginTop: 4,
  },
  createButton: {
    backgroundColor: '#1E40AF',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
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
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#1E40AF',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  subjectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  subjectText: {
    fontSize: 14,
    color: '#4B5563',
    fontStyle: 'italic',
  },
  groupStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  memberCount: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
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
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  createFirstButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  joinFirstButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  joinFirstButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});