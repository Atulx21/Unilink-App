import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator, 
  TextInput,
  Alert,
  RefreshControl,
  Platform
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  Search, 
  X, 
  AlertCircle, 
  Edit2, 
  Save,
  Download,
  Trash2
} from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';

interface StudentMark {
  id: string;
  marks: number;
  student: {
    id: string;
    name: string;
    roll_number?: string;
  };
  editMode?: boolean;
  newMarks?: string;
}

interface Mark {
  id: string;
  title: string;
  description: string;
  max_marks: number;
  created_at: string;
}

export default function MarkDetailScreen() {
  const { id, markId } = useLocalSearchParams();
  const [mark, setMark] = useState<Mark | null>(null);
  const [studentMarks, setStudentMarks] = useState<StudentMark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  useEffect(() => {
    fetchMarkDetails();
  }, [markId]);

  const fetchMarkDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get mark details
      const { data: markData, error: markError } = await supabase
        .from('marks')
        .select('id, title, description, max_marks, created_at')
        .eq('id', markId)
        .single();
        
      if (markError) throw markError;
      
      setMark(markData);
      
      // Get student marks
      const { data: studentMarksData, error: studentMarksError } = await supabase
        .from('student_marks')
        .select(`
          id,
          marks,
          student:profiles(
            id,
            name,
            roll_number
          )
        `)
        .eq('mark_id', markId)
        .order('student(name)', { ascending: true });
        
      if (studentMarksError) throw studentMarksError;
      
      setStudentMarks(studentMarksData || []);
    } catch (error) {
      console.error('Fetch mark details error:', error);
      setError(error.message || 'An error occurred while fetching mark details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMarkDetails();
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const filteredStudentMarks = searchQuery
    ? studentMarks.filter(item => 
        item.student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.student.roll_number && 
          item.student.roll_number.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : studentMarks;

  const toggleEditMode = (studentMarkId: string) => {
    setStudentMarks(current =>
      current.map(item => {
        if (item.id === studentMarkId) {
          return {
            ...item,
            editMode: !item.editMode,
            newMarks: item.editMode ? undefined : item.marks.toString()
          };
        }
        return item;
      })
    );
  };

  const handleMarksChange = (studentMarkId: string, value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, '');
    
    setStudentMarks(current =>
      current.map(item => {
        if (item.id === studentMarkId) {
          return { ...item, newMarks: numericValue };
        }
        return item;
      })
    );
  };

  const saveMarks = async (studentMarkId: string) => {
    try {
      const studentMark = studentMarks.find(item => item.id === studentMarkId);
      if (!studentMark || !studentMark.editMode) return;
      
      // Check if newMarks is a valid number
      if (!studentMark.newMarks || isNaN(parseInt(studentMark.newMarks))) {
        Alert.alert('Invalid Input', 'Please enter a valid number');
        return;
      }
      
      const newMarks = parseInt(studentMark.newMarks);
      
      // Validate marks
      if (mark && (newMarks < 0 || newMarks > mark.max_marks)) {
        Alert.alert('Invalid Marks', `Marks must be between 0 and ${mark.max_marks}`);
        return;
      }
      
      // Update marks in database
      const { error } = await supabase
        .from('student_marks')
        .update({ marks: newMarks })
        .eq('id', studentMarkId);
        
      if (error) throw error;
      
      // Update local state
      setStudentMarks(current =>
        current.map(item => {
          if (item.id === studentMarkId) {
            return {
              ...item,
              marks: newMarks,
              editMode: false,
              newMarks: undefined
            };
          }
          return item;
        })
      );
      
    } catch (error) {
      console.error('Save marks error:', error);
      Alert.alert('Error', 'Failed to save marks. Please try again.');
    }
  };

  const exportMarksToCSV = async () => {
    try {
      if (!mark) return;
      
      // Create CSV content
      let csvContent = 'Student Name,Roll Number,Marks,Max Marks\n';
      
      studentMarks.forEach(item => {
        const studentName = item.student.name || 'Unknown';
        const rollNumber = item.student.roll_number || 'N/A';
        const marks = item.marks;
        const maxMarks = mark.max_marks;
        
        csvContent += `"${studentName}","${rollNumber}",${marks},${maxMarks}\n`;
      });
      
      // Generate filename
      const sanitizedTitle = mark.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
      const filename = `marks_${sanitizedTitle}_${timestamp}.csv`;
      
      // Save file
      const filePath = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(filePath, csvContent);
      
      // Share file
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await Sharing.shareAsync(filePath);
      } else {
        Alert.alert('Export Success', `File saved to ${filePath}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', 'Could not export marks. Please try again.');
    }
  };

  const deleteMark = async () => {
    try {
      Alert.alert(
        'Delete Mark',
        'Are you sure you want to delete this mark? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete', 
            style: 'destructive',
            onPress: async () => {
              // Delete the mark (cascade will delete student_marks)
              const { error } = await supabase
                .from('marks')
                .delete()
                .eq('id', markId);
                
              if (error) throw error;
              
              Alert.alert('Success', 'Mark deleted successfully');
              router.back();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Delete mark error:', error);
      Alert.alert('Error', 'Failed to delete mark. Please try again.');
    }
  };

  const renderStudentMarkItem = ({ item }: { item: StudentMark }) => {
    return (
      <View style={styles.studentMarkCard}>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{item.student.name}</Text>
          {item.student.roll_number && (
            <Text style={styles.studentRoll}>{item.student.roll_number}</Text>
          )}
        </View>
        
        <View style={styles.marksContainer}>
          {item.editMode ? (
            <View style={styles.editMarksContainer}>
              <TextInput
                style={styles.marksInput}
                value={item.newMarks}
                onChangeText={(value) => handleMarksChange(item.id, value)}
                keyboardType="numeric"
                maxLength={3}
                autoFocus
              />
              <Text style={styles.maxMarks}>/ {mark?.max_marks}</Text>
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={() => saveMarks(item.id)}
              >
                <Save size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.displayMarksContainer}>
              <Text style={styles.marks}>{item.marks}</Text>
              <Text style={styles.maxMarks}>/ {mark?.max_marks}</Text>
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => toggleEditMode(item.id)}
              >
                <Edit2 size={18} color="#4B5563" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {mark?.title || 'Mark Details'}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.exportButton}
            onPress={exportMarksToCSV}
          >
            <Download size={24} color="#1F2937" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={deleteMark}
          >
            <Trash2 size={24} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>
      
      {mark && (
        <View style={styles.markInfoContainer}>
          <Text style={styles.markTitle}>{mark.title}</Text>
          {mark.description && (
            <Text style={styles.markDescription}>{mark.description}</Text>
          )}
          <View style={styles.markMetaContainer}>
            <View style={styles.markMeta}>
              <Text style={styles.markMetaLabel}>Max Marks:</Text>
              <Text style={styles.markMetaValue}>{mark.max_marks}</Text>
            </View>
            <View style={styles.markMeta}>
              <Text style={styles.markMetaLabel}>Students:</Text>
              <Text style={styles.markMetaValue}>{studentMarks.length}</Text>
            </View>
            <View style={styles.markMeta}>
              <Text style={styles.markMetaLabel}>Date:</Text>
              <Text style={styles.markMetaValue}>
                {format(new Date(mark.created_at), 'MMM d, yyyy')}
              </Text>
            </View>
          </View>
        </View>
      )}
      
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={20} color="#6B7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search students..."
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E40AF" />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={fetchMarkDetails}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredStudentMarks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchQuery 
              ? 'No students found matching your search' 
              : 'No student marks available'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredStudentMarks}
          renderItem={renderStudentMarkItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#1E40AF']}
              tintColor="#1E40AF"
            />
          }
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
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: 8,
  },
  headerActions: {
    flexDirection: 'row',
  },
  exportButton: {
    padding: 8,
    marginRight: 8,
  },
  deleteButton: {
    padding: 8,
  },
  markInfoContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  markTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  markDescription: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 12,
  },
  markMetaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  markMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  markMetaLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 4,
  },
  markMetaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
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
    marginTop: 16,
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
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  studentMarkCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  studentRoll: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  marksContainer: {
    minWidth: 120,
    alignItems: 'flex-end',
  },
  displayMarksContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  marks: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  maxMarks: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 4,
    marginRight: 8,
  },
  editButton: {
    padding: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
  },
  editMarksContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  marksInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    width: 60,
    textAlign: 'center',
  },
  saveButton: {
    padding: 8,
    backgroundColor: '#1E40AF',
    borderRadius: 8,
    marginLeft: 8,
  },
});