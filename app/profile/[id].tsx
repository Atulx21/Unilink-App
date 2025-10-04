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
  FlatList,
  Alert,
  Dimensions,
  Animated
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, MessageCircle, Heart, Share2, Users } from 'lucide-react-native';
import { format } from 'date-fns';
import { StatusBar } from 'expo-status-bar';

interface Profile {
  id: string;
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

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isCurrentUser, setIsCurrentUser] = useState(false);
  const [connectionCount, setConnectionCount] = useState(0);
  
  // Create the scrollY animated value
  const scrollY = new Animated.Value(0);
  
  // Define the headerHeight and headerOpacity interpolations
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

  useEffect(() => {
    fetchCurrentUser();
    fetchProfile();
  }, [id]);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setCurrentUserId(profile.id);
        setIsCurrentUser(profile.id === id);
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (profileError) throw profileError;

      // Get the public URL for the profile image
      let profileWithImage = { ...profileData };
      
      if (profileData.avatar_url && !profileData.avatar_url.startsWith('http')) {
        const { data } = supabase.storage
          .from('profile_images')
          .getPublicUrl(profileData.avatar_url);
        
        profileWithImage.avatar_url = data.publicUrl;
      }

      setProfile(profileWithImage);

      // Fetch user's posts
      await fetchUserPosts(id as string);
      
      // Fetch connection count
      const { count, error: connectionError } = await supabase
        .from('connections')
        .select('*', { count: 'exact', head: true })
        .or(`follower_id.eq.${id},following_id.eq.${id}`);
      
      if (!connectionError) {
        setConnectionCount(count || 0);
      }
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      setError(error.message || 'Failed to load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUserPosts = async (userId: string) => {
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
        .eq('author_id', userId)
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
        
        // Check if current user has liked this post
        let userHasLiked = false;
        if (currentUserId) {
          const { data: userLike } = await supabase
            .from('post_likes')
            .select('id')
            .eq('post_id', post.id)
            .eq('user_id', currentUserId)
            .single();
          
          userHasLiked = !!userLike;
        }

        // Get public URL for post image if it exists
        let imageUrl = post.image_url;
        if (imageUrl && !imageUrl.startsWith('http')) {
          const { data } = supabase.storage
            .from('post_images')
            .getPublicUrl(imageUrl);
          imageUrl = data.publicUrl;
        }

        return {
          id: post.id,
          content: post.content,
          image_url: imageUrl,
          created_at: post.created_at,
          author_id: post.author_id,
          author_name: post.profiles?.name || 'Unknown',
          author_avatar: post.profiles?.avatar_url,
          likes_count: likesCount || 0,
          comments_count: commentsCount || 0,
          user_has_liked: userHasLiked
        };
      }));

      setPosts(postsWithCounts);
    } catch (error) {
      console.error('Error fetching user posts:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  const handleLikePost = async (postId: string, isLiked: boolean) => {
    if (!currentUserId) {
      Alert.alert('Sign in required', 'Please sign in to like posts');
      return;
    }
    
    try {
      if (isLiked) {
        // Unlike post
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUserId);
      } else {
        // Like post
        await supabase
          .from('post_likes')
          .insert({
            post_id: postId,
            user_id: currentUserId
          });
      }
      
      // Update UI
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

  const navigateToComments = (postId: string) => {
    router.push(`/post/${postId}/comments`);
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.post}>
      <View style={styles.postHeader}>
        <Image 
          source={{ 
            uri: profile?.avatar_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y' 
          }} 
          style={styles.postAvatar} 
        />
        <View style={styles.postUserInfo}>
          <Text style={styles.postUserName}>{profile?.name}</Text>
          <Text style={styles.postDate}>{format(new Date(item.created_at), 'MMM d, yyyy')}</Text>
        </View>
      </View>

      <Text style={styles.postContent}>{item.content}</Text>

      {item.image_url && (
        <Image source={{ uri: item.image_url }} style={styles.postImage} />
      )}

      <View style={styles.postActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleLikePost(item.id, item.user_has_liked)}
        >
          <Heart size={24} color={item.user_has_liked ? "#EF4444" : "#6B7280"} fill={item.user_has_liked ? "#EF4444" : "none"} />
          <Text style={styles.actionText}>{item.likes_count}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigateToComments(item.id)}
        >
          <MessageCircle size={24} color="#6B7280" />
          <Text style={styles.actionText}>{item.comments_count}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Share2 size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'User not found'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Stack.Screen options={{ headerShown: false }} />
      
      <Animated.View 
        style={[
          styles.header, 
          { 
            transform: [{ translateY: headerHeight }],
            opacity: headerOpacity
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{profile.name}</Text>
        <View style={{ width: 24 }} />
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#1E40AF"]}
          />
        }
      >
        <View style={styles.profileHeader}>
          <Image 
            source={{ 
              uri: profile.avatar_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y' 
            }} 
            style={styles.profileImage}
            onError={(e) => console.log('Image loading error:', e.nativeEvent.error)}
          />
          <Text style={styles.profileName}>{profile.name}</Text>
          <Text style={styles.profileRole}>
            {profile.role === 'student' ? 'Student' : 'Teacher'} • {profile.institute_name}
          </Text>
          <Text style={styles.profileDepartment}>{profile.department}</Text>
          
          {profile.role === 'student' && (
            <View style={styles.studentInfo}>
              {profile.roll_number && (
                <Text style={styles.infoText}>Roll: {profile.roll_number}</Text>
              )}
              {profile.current_semester && (
                <Text style={styles.infoText}>Semester: {profile.current_semester}</Text>
              )}
            </View>
          )}
          
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
          
          {!isCurrentUser && (
            <TouchableOpacity style={styles.messageButton}>
              <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.postsSection}>
          <Text style={styles.sectionTitle}>Posts</Text>
          
          {posts.length === 0 ? (
            <View style={styles.emptyPosts}>
              <Text style={styles.emptyPostsText}>No posts yet</Text>
            </View>
          ) : (
            posts.map(post => renderPost({ item: post }))
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    paddingTop: 100, // Add space for the header
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  backButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
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
    backgroundColor: '#F9FAFB',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: '#1E40AF',
    fontWeight: '600',
  },
  profileHeader: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    backgroundColor: '#E5E7EB',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 4,
  },
  profileDepartment: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 12,
  },
  studentInfo: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    marginHorizontal: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '80%',
    marginVertical: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
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
    height: 24,
    backgroundColor: '#D1D5DB',
  },
  messageButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 8,
  },
  messageButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  postsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  emptyPosts: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  emptyPostsText: {
    fontSize: 16,
    color: '#6B7280',
  },
  post: {
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
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },
  postUserInfo: {
    marginLeft: 12,
  },
  postUserName: {
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
  },
  postActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  actionText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#6B7280',
  },
});