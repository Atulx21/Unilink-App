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
  Platform
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { 
  FileText, 
  Upload, 
  Download, 
  Trash2, 
  Search, 
  File, 
  ArrowLeft,
  X
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Linking from 'expo-linking';
import { format } from 'date-fns';

interface Material {
  id: string;
  title: string;
  description: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
  public_url?: string;
}

export default function MaterialsScreen() {
  const { id } = useLocalSearchParams();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMaterials, setFilteredMaterials] = useState<Material[]>([]);

  useEffect(() => {
    fetchMaterials();
    checkRole();
  }, [id]);

  useEffect(() => {
    if (materials.length > 0) {
      setFilteredMaterials(
        materials.filter(material => 
          material.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          material.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }
  }, [searchQuery, materials]);

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

  const fetchMaterials = async () => {
    try {
      setError(null);
      
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .eq('group_id', id)
        .order('created_at', { ascending: false });
  
      if (error) throw error;
      
      // Get public URLs for all materials
      const materialsWithUrls = await Promise.all(data.map(async (material) => {
        try {
          const { data: { publicUrl } } = supabase.storage
            .from('class_materials')
            .getPublicUrl(material.file_path);
          
          return {
            ...material,
            public_url: publicUrl
          };
        } catch (err) {
          console.error('Error getting public URL:', err);
          return {
            ...material,
            public_url: undefined
          };
        }
      }));
  
      setMaterials(materialsWithUrls);
      setFilteredMaterials(materialsWithUrls);
    } catch (error: any) {
      setError(error.message || 'Failed to fetch materials');
      console.error('Error fetching materials:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchMaterials();
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/vnd.ms-powerpoint', 
               'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      
      // Check file size (limit to 10MB)
      if (file.size && file.size > 10 * 1024 * 1024) {
        Alert.alert('File too large', 'Please select a file smaller than 10MB');
        return;
      }

      // Get file extension
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      if (!fileExt || !['pdf', 'ppt', 'pptx'].includes(fileExt)) {
        Alert.alert('Invalid file', 'Please select a PDF or PowerPoint file');
        return;
      }

      // Prompt for title and description
      promptForMetadata(file);
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to select document');
    }
  };

  const promptForMetadata = (file: DocumentPicker.DocumentPickerAsset) => {
    if (Platform.OS === 'ios') {
      let title = '';
      let description = '';
  
      Alert.prompt(
        'Material Title',
        'Enter a title for this material',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Next',
            onPress: (text) => {
              title = text || file.name;
              Alert.prompt(
                'Description (Optional)',
                'Enter a description for this material',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Upload',
                    onPress: (desc) => {
                      description = desc || '';
                      uploadFile(file, title, description);
                    }
                  }
                ]
              );
            }
          }
        ],
        'plain-text',
        file.name
      );
    } else {
      // For Android, use a simpler approach
      Alert.alert(
        'Upload Material',
        'Do you want to upload this file?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Upload',
            onPress: () => uploadFile(file, file.name, '')
          }
        ]
      );
    }
  };

  const uploadFile = async (
    file: DocumentPicker.DocumentPickerAsset, 
    title: string, 
    description: string
  ) => {
    try {
      setUploading(true);
      console.log('Starting upload process for:', file.name);
  
      // Get user profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');
      console.log('User authenticated:', user.id);
  
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
  
      if (profileError) throw profileError;
      console.log('Profile found:', profile.id);
  
      // Create a unique file path
      const fileExt = file.name.split('.').pop();
      const filePath = `${id}/${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      console.log('File path created:', filePath);
  
      // Read the file as base64
      console.log('Reading file from URI:', file.uri);
      const fileContent = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log('File read successfully, content length:', fileContent.length);
  
      // Upload to Supabase Storage - FIXED: Don't use Buffer in React Native
      console.log('Uploading to Supabase storage...');
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('class_materials')
        .upload(filePath, fileContent, {
          contentType: file.mimeType || 'application/octet-stream',
          upsert: true,
        });
  
      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }
      console.log('Upload successful:', uploadData);
  
      // Add record to materials table
      console.log('Adding record to materials table...');
      const { data: insertData, error: insertError } = await supabase
        .from('materials')
        .insert({
          group_id: id,
          title,
          description,
          file_path: filePath,
          file_type: fileExt,
          file_size: file.size || 0,
          uploaded_by: profile.id,
        })
        .select();
  
      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }
      console.log('Record added successfully:', insertData);
  
      Alert.alert('Success', 'Material uploaded successfully');
      fetchMaterials();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      Alert.alert('Upload Failed', error.message || 'An unknown error occurred');
    } finally {
      setUploading(false);
    }
  };

  const deleteMaterial = (material: Material) => {
    Alert.alert(
      'Delete Material',
      `Are you sure you want to delete "${material.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);

              // Delete from storage
              const { error: storageError } = await supabase.storage
                .from('class_materials')
                .remove([material.file_path]);

              if (storageError) throw storageError;

              // Delete from database
              const { error: dbError } = await supabase
                .from('materials')
                .delete()
                .eq('id', material.id);

              if (dbError) throw dbError;

              // Update state
              setMaterials(materials.filter(m => m.id !== material.id));
              Alert.alert('Success', 'Material deleted successfully');
            } catch (error: any) {
              console.error('Error deleting material:', error);
              Alert.alert('Delete Failed', error.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const openMaterial = (material: Material) => {
    if (material.public_url) {
      Linking.openURL(material.public_url);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return <FileText size={24} color="#DC2626" />;
      case 'ppt':
      case 'pptx':
        return <FileText size={24} color="#EA580C" />;
      default:
        return <File size={24} color="#6B7280" />;
    }
  };

  const renderMaterialItem = ({ item }: { item: Material }) => (
    <View style={styles.materialCard}>
      <TouchableOpacity 
        style={styles.materialContent}
        onPress={() => openMaterial(item)}
      >
        <View style={styles.fileIconContainer}>
          {getFileIcon(item.file_type)}
        </View>
        <View style={styles.materialInfo}>
          <Text style={styles.materialTitle}>{item.title}</Text>
          {item.description ? (
            <Text style={styles.materialDescription} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
          <View style={styles.materialMeta}>
            <Text style={styles.materialType}>
              {item.file_type.toUpperCase()} • {formatFileSize(item.file_size)}
            </Text>
            <Text style={styles.materialDate}>
              {format(new Date(item.created_at), 'MMM d, yyyy')}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
      
      {isTeacher && (
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={() => deleteMaterial(item)}
        >
          <Trash2 size={18} color="#EF4444" />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          title: 'Class Materials',
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => router.back()}
              style={{ marginLeft: 16 }}
            >
              <ArrowLeft size={24} color="#000" />
            </TouchableOpacity>
          ),
        }} 
      />

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search materials..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E40AF" />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchMaterials}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredMaterials}
          renderItem={renderMaterialItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FileText size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>No materials found</Text>
              {isTeacher && (
                <Text style={styles.emptySubtext}>
                  Upload PDF or PowerPoint files for your students
                </Text>
              )}
            </View>
          }
        />
      )}

      {isTeacher && (
        <TouchableOpacity 
          style={styles.fab}
          onPress={pickDocument}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Upload size={24} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      )}
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
  searchContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchBar: {
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
  list: {
    padding: 16,
    paddingBottom: 80,
  },
  materialCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  materialContent: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  materialInfo: {
    flex: 1,
  },
  materialTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  materialDescription: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 8,
  },
  materialMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  materialType: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  materialDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#FEF2F2',
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
});
