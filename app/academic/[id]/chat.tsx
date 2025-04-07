import { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  FlatList, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform,
  Keyboard,
  Alert
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Send, User, AtSign } from 'lucide-react-native';
import { format } from 'date-fns';

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender: {
    id: string;
    name: string;
  };
  mentions?: string[];
}

interface Member {
  id: string;
  name: string;
}

export default function GroupChat() {
  const { id } = useLocalSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // Set up real-time subscription
  useEffect(() => {
    fetchGroupDetails();
    fetchMessages();
    fetchMembers();
    getCurrentUser();

    // Subscribe to new messages
    const subscription = supabase
      .channel('chat_messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `group_id=eq.${id}`
      }, (payload) => {
        console.log('New message received:', payload.new);
        // Add the new message to the list
        fetchMessageWithSender(payload.new.id);
      })
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [id]);

  // Filter members when mention query changes
  useEffect(() => {
    if (mentionQuery.length > 0) {
      const filtered = members.filter(member => 
        member.name.toLowerCase().includes(mentionQuery.toLowerCase())
      );
      setFilteredMembers(filtered);
    } else {
      setFilteredMembers(members);
    }
  }, [mentionQuery, members]);

  const getCurrentUser = async () => {
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

  const fetchGroupDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('name')
        .eq('id', id)
        .single();

      if (error) throw error;
      setGroupName(data.name);
    } catch (error: any) {
      console.error('Error fetching group details:', error);
    }
  };

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          member_id,
          profiles (
            id,
            name
          )
        `)
        .eq('group_id', id);

      if (error) throw error;

      const formattedMembers = data.map(item => ({
        id: item.profiles.id,
        name: item.profiles.name
      }));

      setMembers(formattedMembers);
    } catch (error: any) {
      console.error('Error fetching members:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching messages for group:', id);
      
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          id,
          content,
          created_at,
          sender:sender_id (
            id,
            name
          ),
          mentions
        `)
        .eq('group_id', id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        throw error;
      }
      
      console.log('Messages fetched:', data?.length || 0);
      setMessages(data || []);
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessageWithSender = async (messageId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          id,
          content,
          created_at,
          sender:sender_id (
            id,
            name
          ),
          mentions
        `)
        .eq('id', messageId)
        .single();

      if (error) throw error;
      
      // Only add if it's not already in the list
      if (data && !messages.some(m => m.id === data.id)) {
        setMessages(prev => [...prev, data]);
        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error: any) {
      console.error('Error fetching new message:', error);
    }
  };

  const handleSend = async () => {
    if (!messageText.trim()) return;
    
    try {
      setSending(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
        
      if (!profile) throw new Error('Profile not found');
      
      // Extract mentions from the message
      const mentionRegex = /@(\w+)/g;
      const mentionMatches = [...messageText.matchAll(mentionRegex)];
      const mentionedNames = mentionMatches.map(match => match[1]);
      
      // Find the member IDs for the mentioned names
      const mentionedIds = members
        .filter(member => mentionedNames.some(name => 
          member.name.toLowerCase().includes(name.toLowerCase())
        ))
        .map(member => member.id);
      
      // Insert the message
      const { data: newMessage, error } = await supabase
        .from('chat_messages')
        .insert({
          group_id: id,
          sender_id: profile.id,
          content: messageText,
          mentions: mentionedIds.length > 0 ? mentionedIds : null
        })
        .select('id')
        .single();
        
      if (error) throw error;
      
      // Clear the input
      setMessageText('');
      
      // Immediately fetch and display the new message
      if (newMessage?.id) {
        await fetchMessageWithSender(newMessage.id);
      }
      
      // Ensure we scroll to the bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
    } catch (error: any) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleMentionSelect = (member: Member) => {
    // Get the text before and after the @ symbol
    const beforeMention = messageText.substring(0, cursorPosition).split('@').slice(0, -1).join('@');
    const afterMention = messageText.substring(cursorPosition);
    
    // Create the new message text with the mention
    const newMessageText = `${beforeMention}@${member.name} ${afterMention}`;
    
    setMessageText(newMessageText);
    setShowMentions(false);
    setMentionQuery('');
    
    // Focus the input and set cursor position after the mention
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  };

  const handleTextChange = (text: string) => {
    setMessageText(text);
    
    // Check if we need to show mentions
    const lastAtSymbolIndex = text.lastIndexOf('@', cursorPosition);
    
    if (lastAtSymbolIndex !== -1 && lastAtSymbolIndex < cursorPosition) {
      const query = text.substring(lastAtSymbolIndex + 1, cursorPosition);
      setMentionQuery(query);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const handleSelectionChange = (event: any) => {
    setCursorPosition(event.nativeEvent.selection.start);
  };

  const formatTime = (timestamp: string) => {
    return format(new Date(timestamp), 'h:mm a');
  };

  const renderMessage = ({ item }: { item: Message }) => {
    if (!item || !item.sender) {
      console.error('Invalid message item:', item);
      return null;
    }
    
    const isCurrentUser = item.sender.id === currentUserId;
    
    return (
      <View style={[
        styles.messageContainer,
        isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage
      ]}>
        {!isCurrentUser && (
          <View style={styles.avatarContainer}>
            <User size={20} color="#6B7280" />
          </View>
        )}
        <View style={[
          styles.messageBubble,
          isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble
        ]}>
          {!isCurrentUser && (
            <Text style={styles.senderName}>{item.sender.name}</Text>
          )}
          <Text style={[
            styles.messageText,
            isCurrentUser ? styles.currentUserText : styles.otherUserText
          ]}>{item.content}</Text>
          <Text style={[
            styles.messageTime,
            isCurrentUser ? styles.currentUserTime : styles.otherUserTime
          ]}>{formatTime(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  const renderMentionItem = ({ item }: { item: Member }) => (
    <TouchableOpacity 
      style={styles.mentionItem}
      onPress={() => handleMentionSelect(item)}
    >
      <AtSign size={16} color="#4B5563" />
      <Text style={styles.mentionName}>{item.name}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9C6ADE" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen 
        options={{ 
          headerShown: false 
        }} 
      />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.groupName}>{groupName || 'Chat'}</Text>
          <Text style={styles.membersCount}>{members.length} members</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchMessages}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#9C6ADE" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No messages yet. Start the conversation!</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesList}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}
      
      {/* Rest of your component remains the same */}
      
      {showMentions && filteredMembers.length > 0 && (
        <View style={styles.mentionsContainer}>
          <FlatList
            data={filteredMembers}
            renderItem={renderMentionItem}
            keyExtractor={item => item.id}
            style={styles.mentionsList}
            keyboardShouldPersistTaps="always"
          />
        </View>
      )}
      
      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={messageText}
          onChangeText={handleTextChange}
          placeholder="Type a message..."
          multiline
          onSelectionChange={handleSelectionChange}
        />
        <TouchableOpacity 
          style={[styles.sendButton, !messageText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!messageText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Send size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// Update the styles object with these enhanced message styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F7FC', // Changed from #F3F4F6 to light lavender background
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#9C6ADE', // Changed from #1E40AF to purple
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
    paddingTop: 60,
    paddingBottom: 16,
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
  groupName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  membersCount: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 20,
  },
  // Message container styles
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '80%',
  },
  currentUserMessage: {
    alignSelf: 'flex-end',
    marginLeft: 50,
  },
  otherUserMessage: {
    alignSelf: 'flex-start',
    marginRight: 50,
  },
  
  // Avatar styles
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  
  // Message bubble styles
  messageBubble: {
    padding: 12,
    borderRadius: 18,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  currentUserBubble: {
    backgroundColor: '#9C6ADE', // Changed from #1E40AF to purple
    borderBottomRightRadius: 4,
  },
  otherUserBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
  },
  
  // Sender name styles
  senderName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 4,
  },
  
  // Message text styles
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  currentUserText: {
    color: '#FFFFFF',
  },
  otherUserText: {
    color: '#1F2937',
  },
  
  // Message time styles
  messageTime: {
    fontSize: 11,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  currentUserTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherUserTime: {
    color: '#9CA3AF',
  },
  
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#9C6ADE', // Changed from #1E40AF to purple
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  sendButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  mentionsContainer: {
    position: 'absolute',
    bottom: 70,
    left: 16,
    right: 16,
    maxHeight: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mentionsList: {
    maxHeight: 200,
  },
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  mentionName: {
    fontSize: 15,
    color: '#1F2937',
    marginLeft: 8,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6B7280',
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
    textAlign: 'center',
  },
});