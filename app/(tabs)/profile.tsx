import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Animated
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { SquarePen, Users, LogOut, Settings, Calendar, BookOpen, Award } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';

interface Profile {
  name: string;
  role: 'student' | 'teacher';
  institute_name: string;
  department: string;
  roll_number?: string;
  current_semester?: string;
  avatar_url?: string;
}

interface Post {
  id: string;
  content: string;
  image_url?: string;
  created_at: string;
  likes: number;
  comments: number;
}

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionCount, setConnectionCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = new Animated.Value(0);

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, -50],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 60, 90],
    outputRange: [1, 0.3, 0],
    extrapolate: 'clamp',
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No user found');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profile);

      // Fetch sample posts (replace with actual posts from Supabase)
      setPosts([
        {
          id: '1',
          content: 'Just completed my research paper on Machine Learning! 📚',
          image_url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80',
          created_at: '2025-03-31T10:00:00Z',
          likes: 24,
          comments: 5,
        },
        {
          id: '2',
          content: 'Great discussion in today\'s class about artificial intelligence! 🤖',
          created_at: '2025-03-30T15:30:00Z',
          likes: 18,
          comments: 3,
        },
      ]);

      // Set sample connection count (replace with actual count from Supabase)
      setConnectionCount(156);
    } catch (error: any) {
      setError(error.message || 'An error occurred while loading profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/auth/login');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Failed to load profile'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchProfile}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Animated Header */}
      <Animated.View 
        style={[
          styles.animatedHeader, 
          { 
            transform: [{ translateY: headerHeight }],
            opacity: headerOpacity
          }
        ]}
      >
        <Image
          source={{
            uri: profile.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
          }}
          style={styles.headerAvatar}
        />
        <Text style={styles.headerName}>{profile.name}</Text>
      </Animated.View>

      <Animated.ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#1E40AF"]}
            tintColor="#1E40AF"
          />
        }
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
      >
        <View style={styles.profileHeader}>
          <View style={styles.coverImageContainer}>
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80' }} 
              style={styles.coverImage} 
            />
            <View style={styles.avatarContainer}>
              <Image
                source={{
                  uri: profile.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
                }}
                style={styles.avatar}
              />
            </View>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.name}>{profile.name}</Text>
            <View style={styles.roleTag}>
              <Text style={styles.roleText}>{profile.role}</Text>
            </View>
            
            <View style={styles.detailsContainer}>
              <View style={styles.detailItem}>
                <BookOpen size={16} color="#6B7280" />
                <Text style={styles.detailText}>{profile.institute_name}</Text>
              </View>
              
              <View style={styles.detailItem}>
                <Award size={16} color="#6B7280" />
                <Text style={styles.detailText}>{profile.department}</Text>
              </View>
              
              {profile.role === 'student' && profile.roll_number && (
                <View style={styles.detailItem}>
                  <Calendar size={16} color="#6B7280" />
                  <Text style={styles.detailText}>Roll No: {profile.roll_number}</Text>
                </View>
              )}
              
              {profile.role === 'student' && profile.current_semester && (
                <View style={styles.detailItem}>
                  <BookOpen size={16} color="#6B7280" />
                  <Text style={styles.detailText}>Semester: {profile.current_semester}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.statsCard}>
            <TouchableOpacity style={styles.statItem}>
              <Text style={styles.statCount}>{connectionCount}</Text>
              <Text style={styles.statLabel}>Connections</Text>
            </TouchableOpacity>
            
            <View style={styles.statDivider} />
            
            <TouchableOpacity style={styles.statItem}>
              <Text style={styles.statCount}>{posts.length}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </TouchableOpacity>
            
            <View style={styles.statDivider} />
            
            <TouchableOpacity style={styles.statItem}>
              <Text style={styles.statCount}>{profile.role === 'student' ? '4' : '8'}</Text>
              <Text style={styles.statLabel}>Groups</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/post/create')}
            >
              <SquarePen size={18} color="#1E40AF" />
              <Text style={styles.actionButtonText}>New Post</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.editButton]}
              onPress={() => router.push('/profile/edit')}
            >
              <Settings size={18} color="#FFFFFF" />
              <Text style={[styles.actionButtonText, styles.editButtonText]}>Edit Profile</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.logoutButton]}
              onPress={handleLogout}
            >
              <LogOut size={18} color="#DC2626" />
              <Text style={[styles.actionButtonText, styles.logoutButtonText]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.postsSection}>
          <Text style={styles.sectionTitle}>Recent Posts</Text>
          {posts.length > 0 ? (
            posts.map((post) => (
              <View key={post.id} style={styles.postCard}>
                <View style={styles.postHeader}>
                  <Image
                    source={{
                      uri: profile.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
                    }}
                    style={styles.postAvatar}
                  />
                  <View style={styles.postHeaderInfo}>
                    <Text style={styles.postAuthor}>{profile.name}</Text>
                    <Text style={styles.postDate}>{formatDate(post.created_at)}</Text>
                  </View>
                </View>
                
                <Text style={styles.postContent}>{post.content}</Text>
                
                {post.image_url && (
                  <Image 
                    source={{ uri: post.image_url }} 
                    style={styles.postImage}
                    resizeMode="cover"
                  />
                )}
                
                <View style={styles.postActions}>
                  <TouchableOpacity style={styles.postAction}>
                    <Text style={styles.actionCount}>{post.likes}</Text>
                    <Text style={styles.actionText}>Likes</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.actionDivider} />
                  
                  <TouchableOpacity style={styles.postAction}>
                    <Text style={styles.actionCount}>{post.comments}</Text>
                    <Text style={styles.actionText}>Comments</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyPostsContainer}>
              <SquarePen size={48} color="#9CA3AF" />
              <Text style={styles.emptyPostsText}>No posts yet</Text>
              <TouchableOpacity 
                style={styles.createFirstPostButton}
                onPress={() => router.push('/post/create')}
              >
                <Text style={styles.createFirstPostButtonText}>Create your first post</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollView: {
    flex: 1,
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
    backgroundColor: '#F3F4F6',
    padding: 20,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 16,
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
  animatedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 110,
    backgroundColor: '#1E40AF',
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  profileHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  coverImageContainer: {
    height: 180,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  avatarContainer: {
    position: 'absolute',
    bottom: -50,
    left: 24,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  profileInfo: {
    marginTop: 60,
    paddingHorizontal: 24,
  },
  name: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  roleTag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 4,
  },
  roleText: {
    color: '#1E40AF',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  detailsContainer: {
    marginTop: 20,
    gap: 12,
    paddingBottom: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailText: {
    fontSize: 15,
    color: '#4B5563',
  },
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statCount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
    backgroundColor: '#E5E7EB',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  editButton: {
    backgroundColor: '#1E40AF',
  },
  logoutButton: {
    backgroundColor: '#FEF2F2',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
  },
  editButtonText: {
    color: '#FFFFFF',
  },
  logoutButtonText: {
    color: '#DC2626',
  },
  postsSection: {
    padding: 24,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 20,
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  postAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  postHeaderInfo: {
    flex: 1,
  },
  postAuthor: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  postDate: {
    fontSize: 13,
    color: '#6B7280',
  },
  postContent: {
    fontSize: 16,
    color: '#1F2937',
    lineHeight: 24,
    marginBottom: 16,
  },
  postImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginBottom: 16,
  },
  postActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
    marginTop: 8,
  },
  postAction: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  actionCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  actionText: {
    fontSize: 14,
    color: '#6B7280',
  },
  actionDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#E5E7EB',
  },
  emptyPostsContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    marginTop: 8,
  },
  emptyPostsText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 24,
  },
  createFirstPostButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  createFirstPostButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});