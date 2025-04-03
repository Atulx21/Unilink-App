import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

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

const supabaseUrl = 'https://rfnlkxiwaocepmguvjxt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmbmxreGl3YW9jZXBtZ3V2anh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMyNTQzNTQsImV4cCI6MjA1ODgzMDM1NH0.Q3tb5ChdakZBgiG3jL5wo-GEfwzu7ZmkaUl8rTDmr0Q';

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