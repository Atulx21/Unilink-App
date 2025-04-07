import { View, Text } from 'react-native';
import { Redirect } from 'expo-router';

export default function AcademicIndexScreen() {
  // Redirect to the academic tab
  return <Redirect href="/(tabs)/academic" />;
}