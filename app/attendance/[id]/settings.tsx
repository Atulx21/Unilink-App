import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Settings, Clock, Users, TriangleAlert as AlertTriangle } from 'lucide-react-native';

interface GroupSettings {
  id: string;
  name: string;
  allow_self_attendance: boolean;
  attendance_window: number; // in minutes
  penalty_threshold: number;
}

export default function AttendanceSettingsScreen() {
  const { id } = useLocalSearchParams();
  const [settings, setSettings] = useState<GroupSettings>({
    id: '',
    name: '',
    allow_self_attendance: true,
    attendance_window: 15,
    penalty_threshold: 3,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [id]);

  const fetchSettings = async () => {
    try {
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', id)
        .single();

      if (groupError) throw groupError;
      setSettings(group);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const { error: updateError } = await supabase
        .from('groups')
        .update({
          allow_self_attendance: settings.allow_self_attendance,
          attendance_window: settings.attendance_window,
          penalty_threshold: settings.penalty_threshold,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      Alert.alert(
        'Success',
        'Settings have been updated',
        [{ text: 'OK' }]
      );
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Attendance Settings</Text>
        <Text style={styles.subtitle}>{settings.name}</Text>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <AlertTriangle size={20} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Settings size={20} color="#1F2937" />
          <Text style={styles.sectionTitle}>General Settings</Text>
        </View>

        <View style={styles.setting}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Allow Self Attendance</Text>
            <Text style={styles.settingDescription}>
              Let students mark their own attendance during active sessions
            </Text>
          </View>
          <Switch
            value={settings.allow_self_attendance}
            onValueChange={(value) => 
              setSettings(prev => ({ ...prev, allow_self_attendance: value }))
            }
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Clock size={20} color="#1F2937" />
          <Text style={styles.sectionTitle}>Time Settings</Text>
        </View>

        <TouchableOpacity
          style={styles.setting}
          onPress={() => {
            Alert.alert(
              'Attendance Window',
              'How many minutes should students have to mark their attendance?',
              [
                { text: '5 minutes', onPress: () => setSettings(prev => ({ ...prev, attendance_window: 5 })) },
                { text: '10 minutes', onPress: () => setSettings(prev => ({ ...prev, attendance_window: 10 })) },
                { text: '15 minutes', onPress: () => setSettings(prev => ({ ...prev, attendance_window: 15 })) },
                { text: '30 minutes', onPress: () => setSettings(prev => ({ ...prev, attendance_window: 30 })) },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
        >
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Attendance Window</Text>
            <Text style={styles.settingDescription}>
              Time allowed for students to mark attendance
            </Text>
          </View>
          <Text style={styles.settingValue}>{settings.attendance_window} min</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Users size={20} color="#1F2937" />
          <Text style={styles.sectionTitle}>Penalty Settings</Text>
        </View>

        <TouchableOpacity
          style={styles.setting}
          onPress={() => {
            Alert.alert(
              'Penalty Threshold',
              'After how many absences should a penalty be applied?',
              [
                { text: '2 absences', onPress: () => setSettings(prev => ({ ...prev, penalty_threshold: 2 })) },
                { text: '3 absences', onPress: () => setSettings(prev => ({ ...prev, penalty_threshold: 3 })) },
                { text: '4 absences', onPress: () => setSettings(prev => ({ ...prev, penalty_threshold: 4 })) },
                { text: '5 absences', onPress: () => setSettings(prev => ({ ...prev, penalty_threshold: 5 })) },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
        >
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Penalty Threshold</Text>
            <Text style={styles.settingDescription}>
              Number of absences before applying penalties
            </Text>
          </View>
          <Text style={styles.settingValue}>{settings.penalty_threshold}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    color: '#4B5563',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 16,
    marginTop: 1,
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: '#DC2626',
    fontSize: 14,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  setting: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  settingValue: {
    fontSize: 16,
    color: '#1E40AF',
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#1E40AF',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});