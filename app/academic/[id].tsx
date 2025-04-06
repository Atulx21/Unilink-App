import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Book, Award, FileText, MessageSquare, Users, ArrowLeft, Settings } from 'lucide-react-native';

interface Group {
  id: string;
  name: string;
  subject: string;
  owner_id: string;
  member_count: number;
}

export default function AcademicGroupDashboard() {
  const { id } = useLocalSearchParams();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    fetchGroupDetails();
  }, [id]);

  const fetchGroupDetails = async () => {
    try {
      setLoading(true);
      setError(null);

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
        .select(`
          id, 
          name, 
          subject,
          owner_id,
          member_count:group_members(count)
        `)
        .eq('id', id)
        .single();

      if (groupError) throw groupError;
      
      // Format the group data
      const formattedGroup = {
        ...group,
        member_count: typeof group.member_count === 'object' ? 
          (group.member_count[0]?.count || 0) : 
          group.member_count
      };

      setGroup(formattedGroup);
      setIsOwner(group.owner_id === profile?.id);
    } catch (error: any) {
      console.error('Fetch error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
      </View>
    );
  }

  if (error || !group) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Group not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchGroupDetails}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Hide the default header and use our custom one */}
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.groupName}>{group.name}</Text>
          {group.subject && (
            <Text style={styles.subjectText}>{group.subject}</Text>
          )}
        </View>
        {isOwner && (
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => router.push(`/academic/${id}/settings`)}
          >
            <Settings size={24} color="#1F2937" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity 
          style={[styles.card, { borderLeftColor: '#1E40AF' }]}
          activeOpacity={0.7}
          onPress={() => router.push(`/academic/${id}/materials`)}
        >
          <View style={[styles.cardIcon, { backgroundColor: '#EFF6FF' }]}>
            <Book size={24} color="#1E40AF" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Class Material</Text>
            <Text style={styles.cardDescription}>
              Access lecture notes, slides, and resources
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.card, { borderLeftColor: '#059669' }]}
          activeOpacity={0.7}
          onPress={() => router.push(`/academic/${id}/marks`)}
        >
          <View style={[styles.cardIcon, { backgroundColor: '#F0FDF4' }]}>
            <Award size={24} color="#059669" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Marks</Text>
            <Text style={styles.cardDescription}>
              View quiz, assignment, and exam scores
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.card, { borderLeftColor: '#D97706' }]}
          activeOpacity={0.7}
          onPress={() => router.push(`/academic/${id}/assignments`)}
        >
          <View style={[styles.cardIcon, { backgroundColor: '#FEF3C7' }]}>
            <FileText size={24} color="#D97706" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Assignments</Text>
            <Text style={styles.cardDescription}>
              Access and submit assignments and projects
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.card, { borderLeftColor: '#7C3AED' }]}
          activeOpacity={0.7}
          onPress={() => {
            try {
              router.push({
                pathname: `/academic/${id}/chat`,
                params: { id }
              });
            } catch (error) {
              console.error('Navigation error:', error);
              Alert.alert('Navigation Error', 'Could not open chat. Please try again.');
            }
          }}
        >
          <View style={[styles.cardIcon, { backgroundColor: '#F5F3FF' }]}>
            <MessageSquare size={24} color="#7C3AED" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Group Chat</Text>
            <Text style={styles.cardDescription}>
              Communicate with teachers and classmates
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.card, { borderLeftColor: '#DC2626' }]}
          activeOpacity={0.7}
          onPress={() => router.push(`/academic/${id}/members`)}
        >
          <View style={[styles.cardIcon, { backgroundColor: '#FEE2E2' }]}>
            <Users size={24} color="#DC2626" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Members</Text>
            <Text style={styles.cardDescription}>
              View and manage group members
            </Text>
          </View>
        </TouchableOpacity>
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
  settingsButton: {
    padding: 8,
  },
  groupName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  subjectText: {
    fontSize: 18,
    color: '#4B5563',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderLeftWidth: 3,
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
});