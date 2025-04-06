import { useState, useEffect } from 'react';

import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Share, ActivityIndicator, TextInput } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Settings, Copy, Share as ShareIcon, Info, ArrowLeft } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

interface GroupSettings {
  id: string;
  name: string;
  subject: string;
  join_code: string;
  description?: string;
}

export default function AcademicGroupSettingsScreen() {
  const { id } = useLocalSearchParams();
  const [settings, setSettings] = useState<GroupSettings>({
    id: '',
    name: '',
    subject: '',
    join_code: '',
    description: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [id]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', id)
        .single();

      if (groupError) throw groupError;
      
      setSettings({
        id: group.id,
        name: group.name,
        subject: group.subject || '',
        join_code: group.join_code || '',
        description: group.description || '',
      });
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Validate settings before saving
      if (!settings.name.trim()) {
        throw new Error('Group name cannot be empty');
      }

      const { error: updateError } = await supabase
        .from('groups')
        .update({
          name: settings.name,
          subject: settings.subject,
          description: settings.description,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      Alert.alert('Success', 'Group settings updated successfully');
      setEditMode(false);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  const copyJoinCode = async () => {
    try {
      await Clipboard.setStringAsync(settings.join_code);
      Alert.alert('Success', 'Join code copied to clipboard');
    } catch (error) {
      console.error('Error copying join code:', error);
    }
  };

  const shareJoinCode = async () => {
    try {
      await Share.share({
        message: `Join my academic group "${settings.name}" with code: ${settings.join_code}`,
        title: `Join ${settings.name}`,
      });
    } catch (error) {
      console.error('Error sharing join code:', error);
    }
  };

  const regenerateJoinCode = async () => {
    Alert.alert(
      'Regenerate Join Code',
      'Are you sure you want to regenerate the join code? The old code will no longer work.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          onPress: async () => {
            try {
              setSaving(true);
              
              // Generate a new 6-character alphanumeric code
              const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
              let newCode = '';
              for (let i = 0; i < 6; i++) {
                newCode += chars.charAt(Math.floor(Math.random() * chars.length));
              }
              
              const { error: updateError } = await supabase
                .from('groups')
                .update({ join_code: newCode })
                .eq('id', id);

              if (updateError) throw updateError;
              
              setSettings({...settings, join_code: newCode});
              Alert.alert('Success', 'Join code regenerated successfully');
            } catch (error) {
              Alert.alert('Error', error.message);
            } finally {
              setSaving(false);
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

  return (
    <View style={styles.container}>
      {/* Hide the default header */}
      <Stack.Screen options={{ 
        headerShown: false,
      }} />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Group name and subject display at the top */}
        <View style={styles.groupInfoBanner}>
          <Text style={styles.groupName}>{settings.name}</Text>
          {settings.subject && (
            <Text style={styles.subjectText}>{settings.subject}</Text>
          )}
        </View>

        {/* Rest of the content remains the same */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Information</Text>
          
          {editMode ? (
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Group Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={settings.name}
                  onChangeText={(text) => setSettings({...settings, name: text})}
                  placeholder="Enter group name"
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Subject</Text>
                <TextInput
                  style={styles.textInput}
                  value={settings.subject}
                  onChangeText={(text) => setSettings({...settings, subject: text})}
                  placeholder="Enter subject (optional)"
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.textInput, styles.textAreaInput]}
                  value={settings.description}
                  onChangeText={(text) => setSettings({...settings, description: text})}
                  placeholder="Enter group description (optional)"
                  multiline
                  numberOfLines={4}
                />
              </View>
              
              <View style={styles.buttonRow}>
                <TouchableOpacity 
                  style={[styles.button, styles.cancelButton]} 
                  onPress={() => {
                    fetchSettings();
                    setEditMode(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.button, styles.saveButton]} 
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Group Name:</Text>
                <Text style={styles.infoValue}>{settings.name}</Text>
              </View>
              
              {settings.subject && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Subject:</Text>
                  <Text style={styles.infoValue}>{settings.subject}</Text>
                </View>
              )}
              
              {settings.description && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Description:</Text>
                  <Text style={styles.infoValue}>{settings.description}</Text>
                </View>
              )}
              
              <TouchableOpacity 
                style={[styles.button, styles.editButton]} 
                onPress={() => setEditMode(true)}
              >
                <Text style={styles.editButtonText}>Edit Information</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Join Code</Text>
          <View style={styles.codeContainer}>
            <Text style={styles.joinCode}>{settings.join_code}</Text>
            <View style={styles.codeActions}>
              <TouchableOpacity style={styles.codeButton} onPress={copyJoinCode}>
                <Copy size={20} color="#1E40AF" />
                <Text style={styles.codeButtonText}>Copy</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.codeButton} onPress={shareJoinCode}>
                <ShareIcon size={20} color="#1E40AF" />
                <Text style={styles.codeButtonText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <TouchableOpacity 
            style={[styles.button, styles.regenerateButton]} 
            onPress={regenerateJoinCode}
          >
            <Text style={styles.regenerateButtonText}>Regenerate Join Code</Text>
          </TouchableOpacity>
          
          <View style={styles.infoBox}>
            <Info size={16} color="#6B7280" />
            <Text style={styles.infoText}>
              Students can use this code to join your academic group. If you regenerate the code, the old code will no longer work.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <TouchableOpacity 
            style={[styles.button, styles.dangerButton]} 
            onPress={() => {
              Alert.alert(
                'Delete Group',
                'Are you sure you want to delete this group? This action cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Delete', 
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        setSaving(true);
                        
                        // Delete the group
                        const { error: deleteError } = await supabase
                          .from('groups')
                          .delete()
                          .eq('id', id);
                          
                        if (deleteError) throw deleteError;
                        
                        router.replace('/academic');
                      } catch (error) {
                        Alert.alert('Error', error.message);
                        setSaving(false);
                      }
                    }
                  }
                ]
              );
            }}
          >
            <Text style={styles.dangerButtonText}>Delete Group</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    marginRight: 16,
    padding: 8,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  groupInfoBanner: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  groupName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  subjectText: {
    fontSize: 16,
    color: '#4B5563',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
    width: 100,
  },
  infoValue: {
    fontSize: 16,
    color: '#1F2937',
    flex: 1,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  textAreaInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: '#1E40AF',
    flex: 1,
    marginLeft: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    flex: 1,
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#4B5563',
    fontSize: 16,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: '#1E40AF',
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  codeContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  joinCode: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 16,
  },
  codeActions: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  codeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginHorizontal: 8,
  },
  codeButtonText: {
    color: '#1E40AF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  regenerateButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  regenerateButtonText: {
    color: '#4B5563',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    alignItems: 'flex-start',
  },
  infoText: {
    color: '#6B7280',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  dangerButton: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  dangerButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
});