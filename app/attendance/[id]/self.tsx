import { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  SafeAreaView,
  Image,
  ScrollView
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { 
  Users, 
  CircleAlert as AlertCircle, 
  ArrowLeft, 
  Clock, 
  CheckCircle2
} from 'lucide-react-native';

export default function SelfAttendanceScreen() {
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startSelfAttendance = async () => {
    try {
      setLoading(true);
      setError(null);

      // Create a new self-attendance session
      const { data: session, error: sessionError } = await supabase
        .from('attendance_sessions')
        .insert({
          group_id: id,
          type: 'self',
          status: 'active',
          date: new Date().toISOString(),
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      router.push(`/attendance/${id}/self/${session.id}`);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={styles.loadingText}>Setting up attendance session...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={goBack}
        >
          <ArrowLeft size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.title}>Self Attendance</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {error && (
          <View style={styles.errorContainer}>
            <AlertCircle size={20} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Users size={64} color="#FFFFFF" />
          </View>
          
          <Text style={styles.heading}>Start Self Attendance</Text>
          <Text style={styles.description}>
            Students will be able to mark their own attendance for this session.
            The session will remain active until you manually end it.
          </Text>

          <View style={styles.featuresContainer}>
            <View style={styles.featureItem}>
              <CheckCircle2 size={24} color="#059669" style={styles.featureIcon} />
              <Text style={styles.featureText}>Students mark their own attendance</Text>
            </View>
            <View style={styles.featureItem}>
              <CheckCircle2 size={24} color="#059669" style={styles.featureIcon} />
              <Text style={styles.featureText}>Real-time attendance tracking</Text>
            </View>
            <View style={styles.featureItem}>
              <CheckCircle2 size={24} color="#059669" style={styles.featureIcon} />
              <Text style={styles.featureText}>Detailed attendance summary</Text>
            </View>
          </View>

          <View style={styles.warningCard}>
            <AlertCircle size={24} color="#D97706" />
            <Text style={styles.warningText}>
              Make sure to end the session once all students have marked their attendance.
            </Text>
          </View>

          <View style={styles.timeEstimateContainer}>
            <Clock size={20} color="#6B7280" />
            <Text style={styles.timeEstimateText}>
              Estimated time: 5-10 minutes
            </Text>
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              Alert.alert(
                'Start Self Attendance',
                'Are you sure you want to start a self-attendance session?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Start', onPress: startSelfAttendance },
                ]
              );
            }}
          >
            <Text style={styles.buttonText}>Start Session</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#4B5563',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    marginRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureIcon: {
    marginRight: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#1F2937',
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  warningText: {
    flex: 1,
    fontSize: 15,
    color: '#92400E',
    lineHeight: 22,
    marginLeft: 12,
  },
  timeEstimateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  timeEstimateText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  button: {
    backgroundColor: '#1E40AF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
});