import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator, 
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  Platform,
  ScrollView
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { 
  FileText, 
  Upload, 
  Download, 
  Calendar, 
  Clock, 
  Search, 
  File, 
  ArrowLeft,
  X,
  Plus,
  CheckCircle,
  AlertCircle
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Linking from 'expo-linking';
import { format, isPast, formatDistanceToNow } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Assignment {
  id: string;
  title: string;
  description: string;
  file_path?: string;
  file_type?: string;
  file_size?: number;
  deadline: string;
  created_at: string;
  public_url?: string;
  submitted?: boolean;
  submission?: Submission;
}

interface Submission {
  id: string;
  file_path: string;
  file_type: string;
  file_size: number;
  submitted_at: string;
  public_url?: string;
}

export default function AssignmentsScreen() {
  const { id } = useLocalSearchParams();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredAssignments, setFilteredAssignments] = useState<Assignment[]>([]);
  
  // Create assignment state
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Submission state
  const [submissionModalVisible, setSubmissionModalVisible] = useState(false);
  const [currentAssignment, setCurrentAssignment] = useState<Assignment | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchAssignments();
    checkRole();
  }, [id]);

  useEffect(() => {
    if (assignments.length > 0) {
      setFilteredAssignments(
        assignments.filter(assignment => 
          assignment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          assignment.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }
  }, [searchQuery, assignments]);

  const checkRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;

      setCurrentUserId(profile.id);

      const { data: membership, error: membershipError } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', id)
        .eq('member_id', profile.id)
        .single();

      if (membershipError) throw membershipError;

      setIsTeacher(membership.role === 'teacher');
    } catch (error) {
      console.error('Error checking role:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAssignments();
  };

  const fetchAssignments = async () => {
    try {
      setError(null);
      
      // Get current user profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;

      // Get assignments for this group
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('group_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get public URLs for all assignments with files
      const assignmentsWithUrls = await Promise.all(data.map(async (assignment) => {
        let publicUrl = null;
        
        if (assignment.file_path) {
          const { data: { publicUrl: url } } = supabase.storage
            .from('assignments')
            .getPublicUrl(assignment.file_path);
          publicUrl = url;
        }
        
        // Check if the student has submitted this assignment
        const { data: submissions, error: submissionError } = await supabase
          .from('submissions')
          .select('*, student:profiles(name)')
          .eq('assignment_id', assignment.id)
          .eq('student_id', profile.id);
          
        if (submissionError) {
          console.error('Error fetching submissions:', submissionError);
        }
        
        const submission = submissions && submissions.length > 0 ? submissions[0] : null;
        
        // Get public URL for submission if it exists
        let submissionUrl = null;
        if (submission && submission.file_path) {
          const { data: { publicUrl: url } } = supabase.storage
            .from('submissions')
            .getPublicUrl(submission.file_path);
          submissionUrl = url;
        }
        
        return {
          ...assignment,
          public_url: publicUrl,
          submitted: !!submission,
          submission: submission ? {
            ...submission,
            public_url: submissionUrl
          } : undefined
        };
      }));

      setAssignments(assignmentsWithUrls);
      setFilteredAssignments(assignmentsWithUrls);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      setError('Failed to load assignments. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedFile(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Error', 'Failed to pick file. Please try again.');
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDeadline(selectedDate);
    }
  };

  const createAssignment = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    try {
      setUploading(true);

      // Get user profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;

      let filePath = null;
      let fileType = null;
      let fileSize = null;

      // Upload file if selected
      if (selectedFile) {
        // Create a unique file path
        const fileExt = selectedFile.name.split('.').pop();
        filePath = `${id}/${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;

        // Read the file as base64
        const fileContent = await FileSystem.readAsStringAsync(selectedFile.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
        .from('assignments')
        .upload(filePath, fileContent, {
          contentType: selectedFile.mimeType || 'application/octet-stream',
        });

        if (uploadError) throw uploadError;

        fileType = fileExt;
        fileSize = selectedFile.size || 0;
      }

      // Add record to assignments table
      const { error: insertError } = await supabase
        .from('assignments')
        .insert({
          group_id: id,
          title,
          description,
          file_path: filePath,
          file_type: fileType,
          file_size: fileSize,
          deadline: deadline.toISOString(),
          created_by: profile.id,
        });

      if (insertError) throw insertError;

      Alert.alert('Success', 'Assignment created successfully');
      
      // Reset form
      setTitle('');
      setDescription('');
      setDeadline(new Date());
      setSelectedFile(null);
      setModalVisible(false);
      
      // Refresh assignments list
      fetchAssignments();
    } catch (error) {
      console.error('Error creating assignment:', error);
      Alert.alert('Error', 'Failed to create assignment. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const openSubmissionModal = (assignment: Assignment) => {
    setCurrentAssignment(assignment);
    setSubmissionModalVisible(true);
  };

  const submitAssignment = async (file: DocumentPicker.DocumentPickerAsset) => {
    if (!currentAssignment) {
      Alert.alert('Error', 'No assignment selected');
      return;
    }
    
    try {
      setUploading(true);

      // Create a unique file path
      const fileExt = file.name.split('.').pop();
      const filePath = `${currentAssignment.id}/${currentUserId}/${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;

      // Read the file as base64
      const fileContent = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
      .from('submissions')
      .upload(filePath, fileContent, {
        contentType: file.mimeType || 'application/octet-stream',
      });

      if (uploadError) throw uploadError;

      // Check if submission already exists
      const { data: existingSubmission } = await supabase
        .from('submissions')
        .select('id')
        .eq('assignment_id', currentAssignment.id)
        .eq('student_id', currentUserId)
        .single();

      if (existingSubmission) {
        // Update existing submission
        const { error: updateError } = await supabase
          .from('submissions')
          .update({
            file_path: filePath,
            file_type: fileExt,
            file_size: file.size || 0,
            submitted_at: new Date().toISOString(),
          })
          .eq('id', existingSubmission.id);

        if (updateError) throw updateError;
      } else {
        // Create new submission
        const { error: insertError } = await supabase
          .from('submissions')
          .insert({
            assignment_id: currentAssignment.id,
            student_id: currentUserId,
            file_path: filePath,
            file_type: fileExt,
            file_size: file.size || 0,
          });

        if (insertError) throw insertError;
      }

      Alert.alert('Success', 'Assignment submitted successfully');
      setSubmissionModalVisible(false);
      fetchAssignments();
    } catch (error) {
      console.error('Error submitting assignment:', error);
      Alert.alert('Error', 'Failed to submit assignment. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const pickSubmissionFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        submitAssignment(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Error', 'Failed to pick file. Please try again.');
    }
  };

  const downloadFile = async (url: string, filename: string) => {
    try {
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
        return;
      }
      
      Linking.openURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      Alert.alert('Error', 'Failed to download file. Please try again.');
    }
  };

  const renderAssignmentItem = ({ item }: { item: Assignment }) => {
    const deadlinePassed = isPast(new Date(item.deadline));
    
    return (
      <View style={styles.assignmentCard}>
        <View style={styles.assignmentHeader}>
          <Text style={styles.assignmentTitle}>{item.title}</Text>
          <View style={styles.deadlineContainer}>
            <Calendar size={14} color={deadlinePassed ? '#DC2626' : '#4B5563'} />
            <Text style={[
              styles.deadlineText, 
              deadlinePassed && styles.deadlinePassed
            ]}>
              {format(new Date(item.deadline), 'MMM d, yyyy')}
            </Text>
          </View>
        </View>
        
        <Text style={styles.assignmentDescription}>{item.description}</Text>
        
        <View style={styles.assignmentMeta}>
          <View style={styles.timeContainer}>
            <Clock size={14} color="#6B7280" />
            <Text style={styles.timeText}>
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
            </Text>
          </View>
          
          {item.file_path && (
            <TouchableOpacity 
              style={styles.downloadButton}
              onPress={() => downloadFile(item.public_url!, item.file_path!.split('/').pop() || 'assignment')}
            >
              <Download size={14} color="#1E40AF" />
              <Text style={styles.downloadButtonText}>Download</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {!isTeacher && (
          <View style={styles.submissionContainer}>
            {item.submitted ? (
              <View style={styles.submittedContainer}>
                <CheckCircle size={16} color="#059669" style={styles.statusIcon} />
                <Text style={styles.submittedText}>Submitted</Text>
                
                {item.submission && (
                  <TouchableOpacity 
                    style={styles.viewSubmissionButton}
                    onPress={() => downloadFile(item.submission!.public_url!, item.submission!.file_path.split('/').pop() || 'submission')}
                  >
                    <Text style={styles.viewSubmissionText}>View</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : deadlinePassed ? (
              <View style={styles.missedContainer}>
                <AlertCircle size={16} color="#DC2626" style={styles.statusIcon} />
                <Text style={styles.missedText}>Deadline passed</Text>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.submitButton}
                onPress={() => openSubmissionModal(item)}
              >
                <Text style={styles.submitButtonText}>Submit</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={styles.loadingText}>Loading assignments...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <AlertCircle size={48} color="#DC2626" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchAssignments}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerTitle: 'Assignments',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <ArrowLeft size={24} color="#000" />
            </TouchableOpacity>
          ),
        }} 
      />
      
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={20} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search assignments..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {filteredAssignments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FileText size={64} color="#9CA3AF" />
          <Text style={styles.emptyText}>No assignments found</Text>
          <Text style={styles.emptySubtext}>
            {isTeacher 
              ? "Create your first assignment by tapping the '+' button below."
              : "There are no assignments for this class yet."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredAssignments}
          renderItem={renderAssignmentItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#1E40AF']}
              tintColor="#1E40AF"
            />
          }
        />
      )}
      
      {isTeacher && (
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => setModalVisible(true)}
        >
          <Plus size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}
      
      {/* Create Assignment Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
        transparent={false}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <X size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create Assignment</Text>
            <TouchableOpacity 
              style={[styles.createButton, (!title.trim() || uploading) && styles.disabledButton]}
              onPress={createAssignment}
              disabled={!title.trim() || uploading}
            >
              <Text style={styles.createButtonText}>
                {uploading ? 'Creating...' : 'Create'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="Assignment title"
              value={title}
              onChangeText={setTitle}
            />
            
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Assignment description"
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />
            
            <Text style={styles.inputLabel}>Deadline</Text>
            <TouchableOpacity 
              style={styles.datePickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Calendar size={20} color="#4B5563" />
              <Text style={styles.dateText}>
                {format(deadline, 'MMMM d, yyyy')}
              </Text>
            </TouchableOpacity>
            
            <Text style={styles.inputLabel}>Attachment (Optional)</Text>
            {selectedFile ? (
              <View style={styles.selectedFileContainer}>
                <View style={styles.selectedFileInfo}>
                  <File size={20} color="#4B5563" />
                  <Text style={styles.selectedFileName} numberOfLines={1}>
                    {selectedFile.name}
                  </Text>
                </View>
                <TouchableOpacity 
                  style={styles.removeFileButton}
                  onPress={() => setSelectedFile(null)}
                >
                  <X size={20} color="#4B5563" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.uploadButton}
                onPress={pickFile}
              >
                <Upload size={20} color="#4B5563" />
                <Text style={styles.uploadButtonText}>Upload PDF</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
        
        {showDatePicker && (
          <Modal
            transparent={true}
            visible={showDatePicker}
            animationType="fade"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View style={styles.datePickerModalContainer}>
              <View style={styles.datePickerModalContent}>
                <TouchableOpacity 
                  style={styles.datePickerCloseButton}
                  onPress={() => setShowDatePicker(false)}
                >
                  <X size={24} color="#000" />
                </TouchableOpacity>
                {Platform.OS === 'ios' ? (
                  <DateTimePicker
                    value={deadline}
                    mode="date"
                    display="spinner"
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                  />
                ) : (
                  <DateTimePicker
                    value={deadline}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                  />
                )}
              </View>
            </View>
          </Modal>
        )}
      </Modal>
      
      {/* Submission Modal */}
      <Modal
        transparent={true}
        visible={submissionModalVisible}
        animationType="fade"
        onRequestClose={() => setSubmissionModalVisible(false)}
      >
        <View style={styles.submissionModalContainer}>
          <View style={styles.submissionModalContent}>
            <View style={styles.submissionModalHeader}>
              <Text style={styles.submissionModalTitle}>Submit Assignment</Text>
              <TouchableOpacity 
                style={styles.submissionCloseButton}
                onPress={() => setSubmissionModalVisible(false)}
              >
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.submissionText}>
              Please upload your completed assignment as a PDF or DOC file.
            </Text>
            
            <TouchableOpacity 
              style={styles.submissionUploadButton}
              onPress={pickSubmissionFile}
              disabled={uploading}
            >
              <Upload size={20} color="#FFFFFF" />
              <Text style={styles.submissionUploadText}>
                {uploading ? 'Uploading...' : 'Upload File'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#4B5563',
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
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#1F2937',
  },
  listContent: {
    padding: 16,
  },
  assignmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  assignmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  assignmentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    marginRight: 8,
  },
  deadlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deadlineText: {
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 4,
  },
  deadlinePassed: {
    color: '#DC2626',
  },
  assignmentDescription: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 12,
  },
  assignmentMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  submissionContainer: {
    marginTop: 8,
  },
  submittedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    marginRight: 4,
  },
  submittedText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
  },
  missedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  missedText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#1E40AF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  viewSubmissionButton: {
    marginLeft: 8,
    backgroundColor: '#E5E7EB',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  viewSubmissionText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '500',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  downloadButtonText: {
    color: '#1E40AF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
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
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
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
    padding: 40,
    marginTop: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  createButton: {
    backgroundColor: '#1E40AF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  modalContent: {
    padding: 16,
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  dateText: {
    fontSize: 16,
    marginLeft: 8,
    color: '#1F2937',
  },
  selectedFileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  selectedFileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectedFileName: {
    fontSize: 14,
    marginLeft: 8,
    color: '#1F2937',
    flex: 1,
  },
  removeFileButton: {
    padding: 4,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  uploadButtonText: {
    fontSize: 14,
    marginLeft: 8,
    color: '#4B5563',
  },
  submissionModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  submissionModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  submissionModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  submissionModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  submissionCloseButton: {
    padding: 4,
  },
  submissionText: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 20,
  },
  submissionUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  submissionUploadText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  datePickerModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  datePickerModalContent: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    width: '80%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  datePickerCloseButton: {
    padding: 4,
    alignSelf: 'flex-end',
  },
  customDatePickerContainer: {
    alignItems: 'center',
  },
  datePickerText: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 20,
  },
  datePickerConfirmButton: {
    backgroundColor: '#1E40AF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  datePickerConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  }
});