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
  Animated,
  Alert
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { SquarePen, Users, LogOut, Settings, Calendar, BookOpen, Award } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { Heart, MessageCircle } from 'lucide-react-native';
import { format } from 'date-fns';

interface Profile {
  id: string; // Added id field
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
  author_id: string;
  author_name: string;
  author_avatar?: string;
  likes_count: number;
  comments_count: number;
  user_has_liked: boolean;
}

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionCount, setConnectionCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
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

      // Fix: Properly handle the avatar_url
      let profileWithImage = { ...profile };
      
      // Get the public URL for the profile image if it exists
      if (profile.avatar_url && !profile.avatar_url.startsWith('http')) {
        const { data } = supabase.storage
          .from('profile_images')
          .getPublicUrl(profile.avatar_url);
        
        profileWithImage.avatar_url = data.publicUrl;
      }

      setProfile(profileWithImage);
      setProfileId(profile.id);

      // Fetch real posts
      await fetchPosts(profile.id);

      // Fetch connection count
      const { count, error: connectionError } = await supabase
        .from('connections')
        .select('*', { count: 'exact', head: true })
        .or(`follower_id.eq.${profile.id},following_id.eq.${profile.id}`);
      
      if (!connectionError) {
        setConnectionCount(count || 0);
      }
    } catch (error: any) {
      setError(error.message || 'An error occurred while loading profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async (profileId: string) => {
    try {
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          image_url,
          created_at,
          author_id,
          profiles(name, avatar_url)
        `)
        .eq('author_id', profileId)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      // Get likes and comments counts
      const postsWithCounts = await Promise.all(postsData.map(async (post) => {
        // Get likes count
        const { count: likesCount } = await supabase
          .from('post_likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id);
        
        // Get comments count
        const { count: commentsCount } = await supabase
          .from('post_comments')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id);
        
        // Check if user has liked this post
        const { data: userLike } = await supabase
          .from('post_likes')
          .select('id')
          .eq('post_id', post.id)
          .eq('user_id', profileId)
          .single();

        return {
          id: post.id,
          content: post.content,
          image_url: post.image_url,
          created_at: post.created_at,
          author_id: post.author_id,
          author_name: post.profiles?.name || 'Unknown',
          author_avatar: post.profiles?.avatar_url,
          likes_count: likesCount || 0,
          comments_count: commentsCount || 0,
          user_has_liked: !!userLike
        };
      }));

      setPosts(postsWithCounts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  };

  const handleLikePost = async (postId: string, isLiked: boolean) => {
    if (!profileId) return;
    
    try {
      if (isLiked) {
        // Unlike post
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', profileId);
      } else {
        // Like post
        await supabase
          .from('post_likes')
          .insert({
            post_id: postId,
            user_id: profileId
          });
      }

      // Update local state
      setPosts(posts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            likes_count: isLiked ? post.likes_count - 1 : post.likes_count + 1,
            user_has_liked: !isLiked
          };
        }
        return post;
      }));
    } catch (error) {
      console.error('Error liking/unliking post:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const navigateToComments = (postId: string) => {
    router.push(`/post/${postId}/comments`);
  };

  // Add logout function
  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Logout",
          onPress: async () => {
            try {
              const { error } = await supabase.auth.signOut();
              if (error) throw error;
              router.replace('/auth/login');
            } catch (error) {
              console.error('Error logging out:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchProfile}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
        {/* Profile Header */}
        <Animated.View 
          style={[
            styles.profileHeader,
            { 
              transform: [{ translateY: headerHeight }],
              opacity: headerOpacity
            }
          ]}
        >
          <View style={styles.profileImageContainer}>
            <Image 
              source={{ 
                uri: profile?.avatar_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y' 
              }} 
              style={styles.profileImage} 
            />
          </View>
          
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.name}</Text>
            <Text style={styles.profileRole}>{profile?.role === 'student' ? 'Student' : 'Teacher'}</Text>
            <Text style={styles.profileInstitute}>{profile?.institute_name}</Text>
            <Text style={styles.profileDepartment}>{profile?.department}</Text>
            {profile?.role === 'student' && (
              <View style={styles.studentInfo}>
                {profile?.roll_number && (
                  <Text style={styles.profileDetail}>Roll: {profile.roll_number}</Text>
                )}
                {profile?.current_semester && (
                  <Text style={styles.profileDetail}>Semester: {profile.current_semester}</Text>
                )}
              </View>
            )}
          </View>
        </Animated.View>

        {/* Profile Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{posts.length}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{connectionCount}</Text>
            <Text style={styles.statLabel}>Connections</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.push('/profile/edit')}
          >
            <SquarePen size={20} color="#1E40AF" />
            <Text style={styles.actionButtonText}>Edit Profile</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.push('/connections')}
          >
            <Users size={20} color="#1E40AF" />
            <Text style={styles.actionButtonText}>Connections</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Links */}
        <View style={styles.quickLinks}>
          <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/academic')}>
            <View style={[styles.quickLinkIcon, { backgroundColor: '#EFF6FF' }]}>
              <BookOpen size={20} color="#1E40AF" />
            </View>
            <Text style={styles.quickLinkText}>Academic</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/attendance')}>
            <View style={[styles.quickLinkIcon, { backgroundColor: '#F0FDF4' }]}>
              <Calendar size={20} color="#059669" />
            </View>
            <Text style={styles.quickLinkText}>Attendance</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickLink}>
            <View style={[styles.quickLinkIcon, { backgroundColor: '#FEF3C7' }]}>
              <Award size={20} color="#D97706" />
            </View>
            <Text style={styles.quickLinkText}>Results</Text>
          </TouchableOpacity>
          
          {/* Replace Settings with Logout */}
          <TouchableOpacity style={styles.quickLink} onPress={handleLogout}>
            <View style={[styles.quickLinkIcon, { backgroundColor: '#FEE2E2' }]}>
              <LogOut size={20} color="#DC2626" />
            </View>
            <Text style={styles.quickLinkText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Posts Section */}
        <View style={styles.postsSection}>
          <Text style={styles.sectionTitle}>Posts</Text>
          
          {posts.length === 0 ? (
            <View style={styles.emptyPosts}>
              <Text style={styles.emptyPostsText}>No posts yet</Text>
              <TouchableOpacity 
                style={styles.createPostButton}
                onPress={() => router.push('/post/create')}
              >
                <Text style={styles.createPostButtonText}>Create a post</Text>
              </TouchableOpacity>
            </View>
          ) : (
            posts.map(post => (
              <View key={post.id} style={styles.postCard}>
                <View style={styles.postHeader}>
                  <Image 
                    source={{ 
                      uri: post.author_avatar || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y' 
                    }} 
                    style={styles.postAuthorImage} 
                  />
                  <View style={styles.postHeaderInfo}>
                    <Text style={styles.postAuthorName}>{post.author_name}</Text>
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
                  <TouchableOpacity 
                    style={styles.postAction}
                    onPress={() => handleLikePost(post.id, post.user_has_liked)}
                  >
                    <Heart 
                      size={20} 
                      color={post.user_has_liked ? "#EF4444" : "#6B7280"} 
                      fill={post.user_has_liked ? "#EF4444" : "none"} 
                    />
                    <Text style={styles.postActionText}>{post.likes_count}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.postAction}
                    onPress={() => navigateToComments(post.id)}
                  >
                    <MessageCircle size={20} color="#6B7280" />
                    <Text style={styles.postActionText}>{post.comments_count}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => router.push('/post/create')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    paddingBottom: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  profileHeader: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  profileImageContainer: {
    marginRight: 16,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E5E7EB',
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 4,
  },
  profileInstitute: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  profileDepartment: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  studentInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  profileDetail: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
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
    backgroundColor: '#E5E7EB',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
  },
  quickLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    borderRadius: 12,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  quickLink: {
    width: '25%',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickLinkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  quickLinkText: {
    fontSize: 12,
    color: '#4B5563',
  },
  postsSection: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  emptyPosts: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  emptyPostsText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16,
  },
  createPostButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createPostButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  postAuthorImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },
  postHeaderInfo: {
    marginLeft: 12,
  },
  postAuthorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  postDate: {
    fontSize: 14,
    color: '#6B7280',
  },
  postContent: {
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 12,
    lineHeight: 22,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#E5E7EB',
  },
  postActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  postAction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  postActionText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#6B7280',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  fabText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
