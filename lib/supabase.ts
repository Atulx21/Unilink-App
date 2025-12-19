import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { config } from 'dotenv';

// Load environment variables
config();

// Implement a custom storage adapter for Supabase auth
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return Platform.OS === 'web'
      ? localStorage.getItem(key)
      : SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    return Platform.OS === 'web'
      ? localStorage.setItem(key, value)
      : SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    return Platform.OS === 'web'
      ? localStorage.removeItem(key)
      : SecureStore.deleteItemAsync(key);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  db: {
    schema: 'public',
  },
});