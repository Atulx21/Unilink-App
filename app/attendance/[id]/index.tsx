import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Users, UserPlus, ClipboardList, History, Settings, ArrowLeft, CheckCircle } from 'lucide-react-native';

interface Member {
  id: string;
  profile: {
    name: string;
    role: string;
    roll_number?: string;
  };
}

interface Group {
  id: string;
  name: string;
  owner_id: string;
}

export default function GroupScreen() {
  const { id } = useLocalSearchParams();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [stats, setStats] = useState({
    teachers: 0,
    students: 0
  });

  useEffect(() => {
    fetchGroupDetails();
  }, [id]);

  const fetchGroupDetails = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      // Get group details
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', id)
        .single();

      if (groupError) throw groupError;
      setGroup(group);
      setIsOwner(group.owner_id === profile?.id);

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

      if (membersError) throw membersError;
      setMembers(members || []);
      
      // Calculate stats
      const teacherCount = members?.filter(m => m.profile.role === 'teacher').length || 0;
      const studentCount = members?.filter(m => m.profile.role === 'student').length || 0;
      setStats({
        teachers: teacherCount,
        students: studentCount
      });
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderMember = ({ item }: { item: Member }) => (
    <View style={styles.memberCard}>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.profile.name}</Text>
        {item.profile.roll_number && (
          <Text style={styles.rollNumber}>Roll No: {item.profile.roll_number}</Text>
        )}
      </View>
      <View style={[
        styles.roleTagContainer,
        item.profile.role === 'teacher' ? styles.teacherTagContainer : styles.studentTagContainer
      ]}>
        <Text style={[
          styles.roleTag,
          item.profile.role === 'teacher' ? styles.teacherTag : styles.studentTag
        ]}>
          {item.profile.role}
        </Text>
      </View>
    </View>
  );

  // Render different content based on user role (teacher or student)
  const renderStudentView = () => (
    <View style={styles.cardsContainer}>
      <TouchableOpacity 
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => router.push({
          pathname: `/attendance/${id}/mark-attendance`,
          params: { groupId: id }
        })}
      >
        <View style={[styles.cardIcon, { backgroundColor: '#EFF6FF' }]}>
          <CheckCircle size={24} color="#1E40AF" />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>Mark Attendance</Text>
          <Text style={styles.cardDescription}>
            Mark your attendance if a session is active
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => router.push({
          pathname: `/attendance/${id}/student-history`,
          params: { groupId: id }
        })}
      >
        <View style={[styles.cardIcon, { backgroundColor: '#F0FDF4' }]}>
          <History size={24} color="#059669" />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>My Attendance History</Text>
          <Text style={styles.cardDescription}>
            View your attendance records
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => router.push({
          pathname: `/attendance/${id}/members`,
          params: { groupId: id }
        })}
      >
        <View style={[styles.cardIcon, { backgroundColor: '#F5F3FF' }]}>
          <Users size={24} color="#7C3AED" />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>Members</Text>
          <Text style={styles.cardDescription}>
            View all members in this group
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={styles.loadingText}>Loading group details...</Text>
      </View>
    );
  }

  if (error || !group) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorText}>{error || 'Group not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchGroupDetails}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
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
        <Text style={styles.title}>{group.name}</Text>
        {isOwner && (
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => router.push(`/attendance/${id}/settings`)}
          >
            <Settings size={24} color="#1F2937" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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

        {isOwner ? (
          <View style={styles.actionCardsContainer}>
            {/* Teacher view content */}
            <TouchableOpacity
              style={styles.actionCard}
              activeOpacity={0.7}
              onPress={() => router.push(`/attendance/${id}/manual`)}
            >
              <View style={styles.actionIconContainer}>
                <ClipboardList size={28} color="#1E40AF" />
              </View>
              <Text style={styles.actionTitle}>Manual Attendance</Text>
              <Text style={styles.actionDescription}>Mark attendance for all students</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              activeOpacity={0.7}
              onPress={() => router.push(`/attendance/${id}/self`)}
            >
              <View style={styles.actionIconContainer}>
                <Users size={28} color="#1E40AF" />
              </View>
              <Text style={styles.actionTitle}>Self Attendance</Text>
              <Text style={styles.actionDescription}>Let students mark their own attendance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              activeOpacity={0.7}
              onPress={() => router.push(`/attendance/${id}/history`)}
            >
              <View style={styles.actionIconContainer}>
                <History size={28} color="#1E40AF" />
              </View>
              <Text style={styles.actionTitle}>History</Text>
              <Text style={styles.actionDescription}>View past attendance sessions</Text>
            </TouchableOpacity>
          </View>
        ) : (
          renderStudentView()
        )}

        <View style={styles.membersSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Members</Text>
            {isOwner && (
              <TouchableOpacity
                style={styles.addButton}
                activeOpacity={0.7}
                onPress={() => router.push(`/attendance/${id}/add-members`)}
              >
                <UserPlus size={20} color="#FFFFFF" />
                <Text style={styles.addButtonText}>Add Members</Text>
              </TouchableOpacity>
            )}
          </View>

          {members.length === 0 ? (
            <View style={styles.emptyState}>
              <Users size={48} color="#D1D5DB" />
              <Text style={styles.emptyStateText}>No members found</Text>
            </View>
          ) : (
            <FlatList
              data={members}
              renderItem={renderMember}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.membersList}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F3F4F6',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
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
    fontWeight: 'bold',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  settingsButton: {
    padding: 8,
    borderRadius: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  cardsContainer: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  actionCardsContainer: {
    padding: 16,
    gap: 16,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  actionDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  membersSection: {
    marginTop: 8,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E40AF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 6,
  },
  membersList: {
    paddingHorizontal: 16,
  },
  memberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  rollNumber: {
    fontSize: 14,
    color: '#6B7280',
  },
  roleTagContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  teacherTagContainer: {
    backgroundColor: '#EFF6FF',
  },
  studentTagContainer: {
    backgroundColor: '#F0FDF4',
  },
  roleTag: {
    fontSize: 12,
    fontWeight: '500',
  },
  teacherTag: {
    color: '#1E40AF',
  },
  studentTag: {
    color: '#059669',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
});