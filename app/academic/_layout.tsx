import { Stack } from 'expo-router';

export default function AcademicLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen 
        name="create" 
        options={{ 
          title: "Create Academic Group",
          headerShown: true,
        }} 
      />
      <Stack.Screen 
        name="join" 
        options={{ 
          title: "Join Academic Group",
          headerShown: true,
        }} 
      />
      <Stack.Screen 
        name="[id]" 
        options={{ 
          headerShown: true,
        }} 
      />
    </Stack>
  );
}