import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, TextInput, RefreshControl, ActivityIndicator } from 'react-native';
import { Search, Bell, MessageSquare, Heart, MessageCircle, Share2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { format } from 'date-fns';

// Define the Post interface
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

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchCurrentUser();
    fetchPosts();
  }, []);

  // Add search functionality
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      searchUsers(searchQuery);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [searchQuery]);

  const searchUsers = async (query: string) => {
    if (query.trim().length === 0) return;
    
    try {
      setIsSearching(true);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, role, avatar_url, institute_name, department')
        .ilike('name', `%${query}%`)
        .limit(10);
      
      if (error) throw error;
      
      // Get public URLs for avatar images
      const usersWithAvatars = await Promise.all(data.map(async (user) => {
        if (user.avatar_url && !user.avatar_url.startsWith('http')) {
          const { data } = supabase.storage
            .from('profile_images')
            .getPublicUrl(user.avatar_url);
          
          return {
            ...user,
            avatar_url: data.publicUrl
          };
        }
        return user;
      }));
      
      setSearchResults(usersWithAvatars);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const navigateToUserProfile = (userId: string) => {
    router.push(`/profile/${userId}`);
    // Clear search after navigation
    setSearchQuery('');
    setSearchResults([]);
  };

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
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
  };

  const fetchPosts = async () => {
    try {
      setLoading(true);
      
      // Fetch posts with author information
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
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      // Get likes and comments counts for each post
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
          user_has_liked: userHasLiked
        };
      }));

      setPosts(postsWithCounts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPosts();
  };

  const handleLikePost = async (postId: string, isLiked: boolean) => {
    if (!currentUserId) return;
    
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

  const navigateToProfile = (authorId: string) => {
    router.push(`/profile/${authorId}`);
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.post}>
      <TouchableOpacity 
        style={styles.postHeader}
        onPress={() => navigateToProfile(item.author_id)}
      >
        <Image 
          source={{ 
            uri: item.author_avatar || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y' 
          }} 
          style={styles.avatar} 
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.author_name}</Text>
          <Text style={styles.postDate}>{format(new Date(item.created_at), 'MMM d, yyyy')}</Text>
        </View>
      </TouchableOpacity>

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

  const renderSearchResult = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.searchResultItem}
      onPress={() => navigateToUserProfile(item.id)}
    >
      <Image 
        source={{ 
          uri: item.avatar_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y' 
        }} 
        style={styles.searchResultAvatar} 
      />
      <View style={styles.searchResultInfo}>
        <Text style={styles.searchResultName}>{item.name}</Text>
        <Text style={styles.searchResultDetails}>
          {item.role === 'student' ? 'Student' : 'Teacher'} • {item.institute_name}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.appName}>UniLink</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconButton}>
            <Bell size={24} color="#1F2937" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <MessageSquare size={24} color="#1F2937" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#6B7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity 
            onPress={() => setSearchQuery('')}
            style={styles.clearSearch}
          >
            <Text style={styles.clearSearchText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Show search results if searching */}
      {searchQuery.length > 0 && (
        <View style={styles.searchResultsContainer}>
          {isSearching ? (
            <ActivityIndicator size="small" color="#1E40AF" style={styles.searchingIndicator} />
          ) : searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              renderItem={renderSearchResult}
              keyExtractor={item => item.id}
              style={styles.searchResultsList}
            />
          ) : (
            <Text style={styles.noResultsText}>No users found</Text>
          )}
        </View>
      )}

      {/* Show posts only when not searching */}
      {searchQuery.length === 0 && (
        loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1E40AF" />
          </View>
        ) : (
          <FlatList
            data={posts}
            renderItem={renderPost}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={["#1E40AF"]}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No posts yet</Text>
                <TouchableOpacity 
                  style={styles.createPostButton}
                  onPress={() => router.push('/post/create')}
                >
                  <Text style={styles.createPostButtonText}>Create a post</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )
      )}

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  headerActions: {
    flexDirection: 'row',
  },
  iconButton: {
    marginLeft: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#1F2937',
  },
  content: {
    padding: 16,
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },
  userInfo: {
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  userRole: {
    fontSize: 14,
    color: '#6B7280',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
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
  // Update these styles
  searchResultsContainer: {
    position: 'absolute',
    top: 130, // Increased from 120 to prevent overlap
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    zIndex: 10,
    maxHeight: 300,
  },
  searchResultsList: {
    padding: 8,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchResultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },
  searchResultInfo: {
    marginLeft: 12,
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  searchResultDetails: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2, // Added spacing between name and details
  },
  noResultsText: {
    padding: 16,
    textAlign: 'center',
    color: '#6B7280',
  },
  searchingIndicator: {
    padding: 16,
  },
  clearSearch: {
    padding: 8,
  },
  clearSearchText: {
    fontSize: 16,
    color: '#6B7280',
  },
  // Add this new style for spacing when search results are showing
  searchResultsSpacer: {
    flex: 1,
  },
});