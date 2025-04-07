import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Alert,
  Switch
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Check, X } from 'lucide-react-native';

interface Student {
  id: string;
  name: string;
  roll_number?: string;
  marks: string;
}

export default function CreateMarkScreen() {
  const { id } = useLocalSearchParams();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [maxMarks, setMaxMarks] = useState('100');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignToAll, setAssignToAll] = useState(true);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get students in the group
      const { data: members, error: membersError } = await supabase
        .from('group_members')
        .select(`
          member_id,
          profiles:profiles(
            id,
            name,
            role,
            roll_number
          )
        `)
        .eq('group_id', id);

      if (membersError) throw membersError;
      
      // Filter to only include students
      const studentMembers = members
        .filter(member => member.profiles.role === 'student')
        .map(member => ({
          id: member.profiles.id,
          name: member.profiles.name,
          roll_number: member.profiles.roll_number,
          marks: '0'
        }));
      
      setStudents(studentMembers);
    } catch (error) {
      console.error('Fetch students error:', error);
      setError(error.message || 'An error occurred while fetching students');
    } finally {
      setLoading(false);
    }
  };

  const handleMarksChange = (studentId: string, value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, '');
    
    setStudents(current =>
      current.map(student =>
        student.id === studentId
          ? { ...student, marks: numericValue }
          : student
      )
    );
  };

  const handleSubmit = async () => {
    try {
      // Validate inputs
      if (!title.trim()) {
        Alert.alert('Error', 'Please enter a title');
        return;
      }
      
      if (!maxMarks || parseInt(maxMarks) <= 0) {
        Alert.alert('Error', 'Please enter valid maximum marks');
        return;
      }
      
      // Validate student marks
      const maxMarksNum = parseInt(maxMarks);
      const invalidMarks = students.some(student => {
        const marks = parseInt(student.marks || '0');
        return marks < 0 || marks > maxMarksNum;
      });
      
      if (invalidMarks) {
        Alert.alert('Error', `Marks must be between 0 and ${maxMarksNum}`);
        return;
      }
      
      setSubmitting(true);
      
      // Create the mark entry
      const { data: mark, error: markError } = await supabase
        .from('marks')
        .insert({
          group_id: id,
          title,
          description,
          max_marks: parseInt(maxMarks)
        })
        .select()
        .single();
      
      if (markError) throw markError;
      
      // Determine which students to assign marks to
      const studentsToAssign = assignToAll 
        ? students 
        : students.filter(student => student.marks !== '0');
      
      if (studentsToAssign.length === 0) {
        Alert.alert('Success', 'Mark created successfully with no student marks');
        router.back();
        return;
      }
      
      // Create student marks entries
      const studentMarksData = studentsToAssign.map(student => ({
        mark_id: mark.id,
        student_id: student.id,
        marks: parseInt(student.marks || '0')
      }));
      
      const { error: studentMarksError } = await supabase
        .from('student_marks')
        .insert(studentMarksData);
      
      if (studentMarksError) throw studentMarksError;
      
      Alert.alert(
        'Success', 
        'Mark created successfully', 
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Error', error.message || 'Failed to create mark');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          headerShown: false,
        }} 
      />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create New Mark</Text>
        <TouchableOpacity 
          style={[
            styles.saveButton,
            (submitting || !title.trim()) && styles.saveButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={submitting || !title.trim()}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Check size={24} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E40AF" />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={fetchStudents}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Mark Details</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g., Midterm Exam"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Add details about this mark"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Maximum Marks *</Text>
              <TextInput
                style={styles.input}
                value={maxMarks}
                onChangeText={setMaxMarks}
                placeholder="100"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
              />
            </View>
          </View>
          
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Student Marks</Text>
              <View style={styles.toggleContainer}>
                <Text style={styles.toggleLabel}>
                  {assignToAll ? 'All Students' : 'Selected Students'}
                </Text>
                <Switch
                  value={assignToAll}
                  onValueChange={setAssignToAll}
                  trackColor={{ false: '#D1D5DB', true: '#BFDBFE' }}
                  thumbColor={assignToAll ? '#1E40AF' : '#9CA3AF'}
                />
              </View>
            </View>
            
            {students.length === 0 ? (
              <View style={styles.emptyStudents}>
                <Text style={styles.emptyText}>No students in this group</Text>
              </View>
            ) : (
              students.map(student => (
                <View key={student.id} style={styles.studentRow}>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{student.name}</Text>
                    {student.roll_number && (
                      <Text style={styles.studentRoll}>{student.roll_number}</Text>
                    )}
                  </View>
                  <TextInput
                    style={styles.marksInput}
                    value={student.marks}
                    onChangeText={(value) => handleMarksChange(student.id, value)}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                </View>
              ))
            )}
          </View>
        </ScrollView>
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
  saveButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 8,
    padding: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 16,
  },
  retryButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  formSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 14,
    color: '#4B5563',
    marginRight: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  emptyStudents: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  studentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  studentRoll: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  marksInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    width: 60,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
});