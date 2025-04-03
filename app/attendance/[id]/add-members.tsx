import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Search, UserPlus, X } from 'lucide-react-native';

interface User {
  id: string;
  name: string;
  role: string;
  roll_number?: string;
  selected?: boolean;
}

export default function AddMembersScreen() {
  const { id } = useLocalSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Get existing members to exclude them
      const { data: existingMembers } = await supabase
        .from('group_members')
        .select('member_id')
        .eq('group_id', id);

      const existingIds = existingMembers?.map(m => m.member_id) || [];

      // Get all users except existing members
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .not('id', 'in', `(${existingIds.join(',')})`)
        .order('name');

      if (usersError) throw usersError;
      setUsers(users || []);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setUsers(current =>
      current.map(user =>
        user.id === userId
          ? { ...user, selected: !user.selected }
          : user
      )
    );
  };

  const handleAddMembers = async () => {
    try {
      setSubmitting(true);
      const selectedUsers = users.filter(user => user.selected);

      if (selectedUsers.length === 0) {
        setError('Please select at least one user');
        return;
      }

      const members = selectedUsers.map(user => ({
        group_id: id,
        member_id: user.id,
        role: user.role,
      }));

      const { error: membersError } = await supabase
        .from('group_members')
        .insert(members);

      if (membersError) throw membersError;

      router.back();
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.roll_number && user.roll_number.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderUser = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={[styles.userCard, item.selected && styles.userCardSelected]}
      onPress={() => toggleUserSelection(item.id)}
    >
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        {item.roll_number && (
          <Text style={styles.rollNumber}>Roll No: {item.roll_number}</Text>
        )}
      </View>
      <View style={[
        styles.roleTag,
        item.role === 'teacher' ? styles.teacherTag : styles.studentTag
      ]}>
        <Text style={[
          styles.roleText,
          item.role === 'teacher' ? styles.teacherText : styles.studentText
        ]}>
          {item.role}
        </Text>
      </View>
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
        <Text style={styles.title}>Add Members</Text>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#6B7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or roll number"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={20} color="#6B7280" />
          </TouchableOpacity>
        ) : null}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={filteredUsers}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.addButton, submitting && styles.addButtonDisabled]}
          onPress={handleAddMembers}
          disabled={submitting || users.filter(u => u.selected).length === 0}
        >
          <UserPlus size={20} color="#FFFFFF" />
          <Text style={styles.addButtonText}>
            {submitting ? 'Adding Members...' : 'Add Selected Members'}
          </Text>
        </TouchableOpacity>
      </View>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  userCardSelected: {
    borderColor: '#1E40AF',
    backgroundColor: '#EFF6FF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  rollNumber: {
    fontSize: 14,
    color: '#6B7280',
  },
  roleTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  teacherTag: {
    backgroundColor: '#EFF6FF',
  },
  studentTag: {
    backgroundColor: '#F3F4F6',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '500',
  },
  teacherText: {
    color: '#1E40AF',
  },
  studentText: {
    color: '#4B5563',
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  addButton: {
    backgroundColor: '#1E40AF',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonDisabled: {
    opacity: 0.7,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#DC2626',
    padding: 20,
    textAlign: 'center',
  },
});