import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { BookOpen, Plus, FileText, Calendar } from 'lucide-react-native';

interface AcademicGroup {
  id: string;
  name: string;
  owner_id: string;
  post_count: number;
  recent_post: {
    title: string;
    type: string;
    created_at: string;
  } | null;
}

export default function AcademicScreen() {
  const [groups, setGroups] = useState<AcademicGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'student' | 'teacher' | null>(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Get user role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      setUserRole(profile?.role);

      // Get groups with recent post
      const { data: groups, error } = await supabase
        .from('groups')
        .select(`
          id,
          name,
          owner_id,
          post_count:academic_posts(count),
          recent_post:academic_posts(
            title,
            type,
            created_at
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGroups(groups || []);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderGroup = ({ item }: { item: AcademicGroup }) => (
    <TouchableOpacity
      style={styles.groupCard}
      onPress={() => router.push(`/academic/${item.id}`)}
    >
      <View style={styles.groupHeader}>
        <Text style={styles.groupName}>{item.name}</Text>
        <View style={styles.postCount}>
          <FileText size={16} color="#6B7280" />
          <Text style={styles.postCountText}>{item.post_count} posts</Text>
        </View>
      </View>

      {item.recent_post && (
        <View style={styles.recentPost}>
          <Text style={styles.recentPostLabel}>Recent Activity</Text>
          <Text style={styles.recentPostTitle}>{item.recent_post.title}</Text>
          <View style={styles.recentPostMeta}>
            <Text style={styles.postType}>{item.recent_post.type}</Text>
            <Text style={styles.postDate}>
              {new Date(item.recent_post.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
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
        <Text style={styles.title}>Academic</Text>
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
          {userRole === 'teacher' && (
            <TouchableOpacity
              style={styles.createFirstButton}
              onPress={() => router.push('/academic/create')}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  postCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postCountText: {
    fontSize: 14,
    color: '#6B7280',
  },
  recentPost: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  recentPostLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  recentPostTitle: {
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 8,
  },
  recentPostMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  postType: {
    fontSize: 12,
    color: '#1E40AF',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  postDate: {
    fontSize: 12,
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
  },
  createFirstButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createFirstButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});