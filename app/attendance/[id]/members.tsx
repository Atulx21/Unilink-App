import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
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

export default function MembersScreen() {
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

  const filteredMembers = members.filter(member => {
    if (!searchQuery.trim()) return true;
    
    const searchLower = searchQuery.toLowerCase().trim();
    return (
      (member.profile?.name && member.profile.name.toLowerCase().includes(searchLower)) ||
      (member.profile?.roll_number && member.profile.roll_number.toLowerCase().includes(searchLower))
    );
  });

  const handleSearch = (text: string) => {
    setSearchQuery(text);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMembers();
  };

  const renderMember = ({ item }: { item: Member }) => (
    <View style={styles.memberCard}>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.profile?.name || 'Unknown'}</Text>
        {item.profile?.roll_number && (
          <Text style={styles.rollNumber}>Roll No: {item.profile.roll_number}</Text>
        )}
      </View>
      <View style={[
        styles.roleTagContainer,
        item.profile?.role === 'teacher' ? styles.teacherTagContainer : styles.studentTagContainer
      ]}>
        <Text style={[
          styles.roleTag,
          item.profile?.role === 'teacher' ? styles.teacherTag : styles.studentTag
        ]}>
          {item.profile?.role || 'unknown'}
        </Text>
      </View>
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
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.title}>Members</Text>
        {isOwner && (
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => router.push(`/attendance/${id}/add-members`)}
          >
            <UserPlus size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
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
        <>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.students}</Text>
              <Text style={styles.statLabel}>Students</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.teachers}</Text>
              <Text style={styles.statLabel}>Teachers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{members.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          </View>

          {members.length > 0 ? (
            <FlatList
              data={filteredMembers}
              renderItem={renderMember}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              ListHeaderComponent={
                <View style={styles.searchContainer}>
                  <Search size={20} color="#6B7280" style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name or roll number"
                    placeholderTextColor="#9CA3AF"
                    value={searchQuery}
                    onChangeText={handleSearch}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                      <X size={18} color="#6B7280" />
                    </TouchableOpacity>
                  )}
                </View>
              }
              ListEmptyComponent={
                searchQuery.length > 0 ? (
                  <View style={styles.noResultsContainer}>
                    <Text style={styles.noResultsText}>No members found matching "{searchQuery}"</Text>
                    <TouchableOpacity onPress={clearSearch} style={styles.clearSearchButton}>
                      <Text style={styles.clearSearchText}>Clear search</Text>
                    </TouchableOpacity>
                  </View>
                ) : null
              }
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Users size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>No members found</Text>
              {isOwner && (
                <TouchableOpacity
                  style={styles.addFirstButton}
                  onPress={() => router.push(`/attendance/${id}/add-members`)}
                >
                  <Text style={styles.addFirstButtonText}>Add your first member</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
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
    backgroundColor: '#F3F4F6',
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
    marginTop: 12,
    marginBottom: 20,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    elevation: 2,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'left',
  },
  addButton: {
    backgroundColor: '#1E40AF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  list: {
    padding: 16,
    paddingTop: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 36,
    fontSize: 16,
    color: '#1F2937',
    padding: 0,
    fontWeight: '400',
  },
  clearButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  noResultsContainer: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 16,
  },
  noResultsText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  clearSearchButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
  },
  clearSearchText: {
    color: '#4B5563',
    fontWeight: '500',
    fontSize: 14,
  },
  memberCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    elevation: 2,
  },
  memberInfo: {
    flex: 1,
    marginRight: 12,
  },
  memberName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  rollNumber: {
    fontSize: 14,
    color: '#6B7280',
    letterSpacing: 0.2,
  },
  roleTagContainer: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  teacherTagContainer: {
    backgroundColor: '#EFF6FF',
  },
  studentTagContainer: {
    backgroundColor: '#F0FDF4',
  },
  roleTag: {
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  teacherTag: {
    color: '#1E40AF',
  },
  studentTag: {
    color: '#059669',
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
  addFirstButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 2,
  },
  addFirstButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});