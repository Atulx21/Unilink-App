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
  Award,
  Plus,
  Download,
  FileText
} from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';

interface Mark {
  id: string;
  title: string;
  description: string;
  max_marks: number;
  created_at: string;
  student_marks?: {
    id: string;
    marks: number;
    student: {
      name: string;
    };
  }[];
}

interface StudentMark {
  id: string;
  title: string;
  description: string;
  max_marks: number;
  marks: number;
  created_at: string;
}

export default function MarksScreen() {
  const { id } = useLocalSearchParams();
  const [marks, setMarks] = useState<Mark[] | StudentMark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  useEffect(() => {
    fetchMarks();
  }, [id]);

  const fetchMarks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No user found');

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('user_id', user.id)
        .single();
        
      if (profileError) {
        console.error('Profile error:', profileError);
        throw new Error('Could not fetch your profile');
      }
      
      if (!profile) {
        throw new Error('Profile not found');
      }
      
      setIsTeacher(profile.role === 'teacher');
      setCurrentUserId(profile.id);
      
      if (profile.role === 'teacher') {
        // Teachers see all marks with student details
        const { data: marksData, error: marksError } = await supabase
          .from('marks')
          .select(`
            id,
            title,
            description,
            max_marks,
            created_at,
            student_marks:student_marks(
              id,
              marks,
              student:profiles(
                name
              )
            )
          `)
          .eq('group_id', id)
          .order('created_at', { ascending: false });

        if (marksError) {
          console.error('Marks error:', marksError);
          throw new Error('Could not fetch marks');
        }
        
        setMarks(marksData || []);
      } else {
        // Students only see their own marks
        const { data: studentMarks, error: studentMarksError } = await supabase
          .from('student_marks')
          .select(`
            id,
            marks,
            mark:marks(
              id,
              title,
              description,
              max_marks,
              created_at,
              group_id
            )
          `)
          .eq('student_id', profile.id)
          .eq('mark.group_id', id);

        if (studentMarksError) {
          console.error('Student marks error:', studentMarksError);
          throw new Error('Could not fetch your marks');
        }
        
        // Filter out any null marks and map to the expected format
        const formattedMarks = studentMarks
          ?.filter(item => item.mark !== null)
          .map(item => ({
            id: item.id,
            title: item.mark?.title || 'Untitled Mark',
            description: item.mark?.description || '',
            max_marks: item.mark?.max_marks || 0,
            marks: item.marks || 0,
            created_at: item.mark?.created_at || new Date().toISOString()
          })) || [];
        
        setMarks(formattedMarks);
      }
    } catch (error) {
      console.error('Fetch marks error:', error);
      setError(error.message || 'An error occurred while fetching marks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMarks();
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const filteredMarks = searchQuery
    ? marks.filter(mark => 
        mark.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mark.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : marks;

  const exportMarksToCSV = async (markId: string, title: string) => {
    try {
      if (!isTeacher) return;
      
      // Get the mark details with student marks
      const { data: markData, error: markError } = await supabase
        .from('marks')
        .select(`
          id,
          title,
          max_marks,
          student_marks:student_marks(
            marks,
            student:profiles(
              name,
              roll_number
            )
          )
        `)
        .eq('id', markId)
        .single();
        
      if (markError) throw markError;
      
      // Create CSV content
      let csvContent = 'Student Name,Roll Number,Marks,Max Marks\n';
      
      markData.student_marks.forEach(item => {
        const studentName = item.student.name || 'Unknown';
        const rollNumber = item.student.roll_number || 'N/A';
        const marks = item.marks;
        const maxMarks = markData.max_marks;
        
        csvContent += `"${studentName}","${rollNumber}",${marks},${maxMarks}\n`;
      });
      
      // Generate filename
      const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
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

  const renderTeacherMarkItem = ({ item }: { item: Mark }) => {
    const studentCount = item.student_marks?.length || 0;
    
    return (
      <TouchableOpacity 
        style={styles.markCard}
        onPress={() => router.push(`/academic/${id}/marks/${item.id}`)}
      >
        <View style={styles.markHeader}>
          <Text style={styles.markTitle}>{item.title}</Text>
          <View style={styles.markActions}>
            <TouchableOpacity 
              style={styles.exportButton}
              onPress={() => exportMarksToCSV(item.id, item.title)}
            >
              <Download size={18} color="#4B5563" />
            </TouchableOpacity>
          </View>
        </View>
        
        <Text style={styles.markDescription}>{item.description}</Text>
        
        <View style={styles.markFooter}>
          <Text style={styles.markInfo}>
            Max Marks: <Text style={styles.markValue}>{item.max_marks}</Text>
          </Text>
          <Text style={styles.markInfo}>
            Students: <Text style={styles.markValue}>{studentCount}</Text>
          </Text>
          <Text style={styles.markDate}>
            {format(new Date(item.created_at), 'MMM d, yyyy')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderStudentMarkItem = ({ item }: { item: StudentMark }) => {
    // Add safety checks to prevent errors
    if (!item || item.max_marks === undefined || item.max_marks === 0) {
      return null; // Don't render invalid items
    }
    
    const percentage = (item.marks / item.max_marks) * 100;
    let gradeColor = '#DC2626'; // Red for low marks
    
    if (percentage >= 80) {
      gradeColor = '#059669'; // Green for high marks
    } else if (percentage >= 60) {
      gradeColor = '#0284C7'; // Blue for medium marks
    } else if (percentage >= 40) {
      gradeColor = '#D97706'; // Orange for passing marks
    }
    
    return (
      <View style={styles.markCard}>
        <Text style={styles.markTitle}>{item.title || 'Untitled Mark'}</Text>
        <Text style={styles.markDescription}>{item.description || ''}</Text>
        
        <View style={styles.markScoreContainer}>
          <View style={styles.markScoreBox}>
            <Text style={[styles.markScore, { color: gradeColor }]}>
              {item.marks}
            </Text>
            <Text style={styles.markMaxScore}>/ {item.max_marks}</Text>
          </View>
          <Text style={[styles.markPercentage, { color: gradeColor }]}>
            {percentage.toFixed(1)}%
          </Text>
        </View>
        
        <Text style={styles.markDate}>
          {format(new Date(item.created_at || new Date()), 'MMM d, yyyy')}
        </Text>
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
        <Text style={styles.headerTitle}>Marks</Text>
        {isTeacher && (
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => router.push(`/academic/${id}/marks/create`)}
          >
            <Plus size={24} color="#1F2937" />
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={20} color="#6B7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search marks..."
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
            onPress={fetchMarks}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredMarks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Award size={64} color="#9CA3AF" />
          <Text style={styles.emptyText}>
            {searchQuery 
              ? 'No marks found matching your search' 
              : isTeacher 
                ? 'No marks added yet. Create your first mark!' 
                : 'No marks available yet'}
          </Text>
          {isTeacher && !searchQuery && (
            <TouchableOpacity 
              style={styles.createButton}
              onPress={() => router.push(`/academic/${id}/marks/create`)}
            >
              <Text style={styles.createButtonText}>Create Mark</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredMarks}
          renderItem={isTeacher ? renderTeacherMarkItem : renderStudentMarkItem}
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
  addButton: {
    padding: 8,
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
    marginTop: 16,
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  markCard: {
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
  },
  markHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  markTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  markActions: {
    flexDirection: 'row',
  },
  exportButton: {
    padding: 8,
  },
  markDescription: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 12,
  },
  markFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  markInfo: {
    fontSize: 14,
    color: '#6B7280',
  },
  markValue: {
    fontWeight: '600',
    color: '#1F2937',
  },
  markDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  markScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 12,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
  },
  markScoreBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  markScore: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  markMaxScore: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 4,
  },
  markPercentage: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});