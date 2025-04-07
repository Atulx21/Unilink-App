import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Users, UserPlus, Search, X, AlertCircle } from 'lucide-react-native';

interface Member {
  id: string;
  profile: {
    name: string;
    role: string;
    roll_number?: string;
  };
}

export default function AcademicMembersScreen() {
  const { id } = useLocalSearchParams();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [stats, setStats] = useState({
    teachers: 0,
    students: 0
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, [id]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No user found');

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
        
      if (profileError) {
        console.error('Profile error:', profileError);
        throw new Error('Could not fetch your profile');
      }
      
      if (!profile) {
        throw new Error('Profile not found');
      }

      // Get group details
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('owner_id')
        .eq('id', id)
        .single();

      if (groupError) {
        console.error('Group error:', groupError);
        throw new Error('Could not fetch group details');
      }
      
      setIsOwner(group.owner_id === profile.id);
      
      // Get members
      const { data: members, error: membersError } = await supabase
        .from('group_members')
        .select(`
          id,
          profile:profiles(
            name,
            role,
            roll_number
          )
        `)
        .eq('group_id', id)
        .order('created_at', { ascending: true });

      if (membersError) {
        console.error('Members error:', membersError);
        throw new Error('Could not fetch group members');
      }
      
      // Filter out any members with null profiles (in case of data inconsistency)
      const validMembers = members?.filter(m => m.profile) || [];
      setMembers(validMembers);
      
      // Calculate stats
      const teacherCount = validMembers.filter(m => m.profile.role === 'teacher').length || 0;
      const studentCount = validMembers.filter(m => m.profile.role === 'student').length || 0;
      setStats({
        teachers: teacherCount,
        students: studentCount
      });
    } catch (error) {
      console.error('Fetch members error:', error);
      setError(error.message || 'An error occurred while fetching members');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMembers();
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const handleRemoveMember = (memberId: string) => {
    if (!isOwner) return;
    
    Alert.alert(
      'Remove Member',
      'Are you sure you want to remove this member from the group?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('group_members')
                .delete()
                .eq('id', memberId);
                
              if (error) throw error;
              
              // Update the local state
              setMembers(current => current.filter(m => m.id !== memberId));
              
              // Update stats
              const removedMember = members.find(m => m.id === memberId);
              if (removedMember) {
                const role = removedMember.profile.role;
                setStats(current => ({
                  ...current,
                  [role === 'teacher' ? 'teachers' : 'students']: 
                    current[role === 'teacher' ? 'teachers' : 'students'] - 1
                }));
              }
              
              Alert.alert('Success', 'Member removed successfully');
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to remove member');
            }
          }
        }
      ]
    );
  };

  const filteredMembers = members.filter(member => {
    const name = member.profile.name.toLowerCase();
    const rollNumber = member.profile.roll_number?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    
    return name.includes(query) || rollNumber.includes(query);
  });

  const renderMember = ({ item }: { item: Member }) => (
    <View style={styles.memberCard}>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.profile.name}</Text>
        <View style={styles.memberDetails}>
          <Text style={styles.memberRole}>
            {item.profile.role === 'teacher' ? 'Teacher' : 'Student'}
          </Text>
          {item.profile.roll_number && (
            <Text style={styles.rollNumber}>Roll No: {item.profile.roll_number}</Text>
          )}
        </View>
      </View>
      
      {isOwner && (
        <TouchableOpacity 
          style={styles.removeButton}
          onPress={() => handleRemoveMember(item.id)}
        >
          <X size={18} color="#DC2626" />
        </TouchableOpacity>
      )}
    </View>
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
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Members</Text>
        </View>
        {isOwner && (
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => router.push(`/academic/${id}/add-members`)}
          >
            <UserPlus size={24} color="#1E40AF" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.teachers}</Text>
          <Text style={styles.statLabel}>Teachers</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.students}</Text>
          <Text style={styles.statLabel}>Students</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.teachers + stats.students}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={20} color="#6B7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or roll number"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <X size={18} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <AlertCircle size={24} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={fetchMembers}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredMembers}
          renderItem={renderMember}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Users size={40} color="#9CA3AF" />
              <Text style={styles.emptyText}>
                {searchQuery.length > 0 
                  ? 'No members match your search' 
                  : 'No members in this group yet'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    elevation: 2,
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  addButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  statLabel: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 4,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#1F2937',
  },
  clearButton: {
    padding: 8,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  memberCard: {
    flexDirection: 'row',
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
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  memberDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberRole: {
    fontSize: 14,
    color: '#4B5563',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 8,
  },
  rollNumber: {
    fontSize: 14,
    color: '#6B7280',
  },
  removeButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 16,
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
    marginVertical: 16,
  },
  retryButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});