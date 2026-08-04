import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { EmergencyProvider } from './src/contexts/EmergencyContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { UserDashboardScreen } from './src/screens/UserDashboardScreen';
import { GuardianScreen } from './src/screens/GuardianScreen';
import { COLORS } from './src/styles/theme';

const Stack = createStackNavigator();

// Screen options — hide the native header (we use custom headers)
const screenOptions = {
  headerShown: false,
  cardStyle: { backgroundColor: COLORS.bg },
  gestureEnabled: true,
};

const AuthenticatedNavigator = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={COLORS.cyan} size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions} initialRouteName={user ? (user.role === 'admin' ? 'Dashboard' : 'Dashboard') : 'Login'}>
      {/* Public */}
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="Guardian" component={GuardianScreen} />

      {/* Protected — role checked inside screen via useAuth */}
      <Stack.Screen name="Dashboard" component={UserDashboardScreen} />
    </Stack.Navigator>
  );
};

export default function App() {
  return (
    <NavigationContainer>
      <AuthProvider>
        <EmergencyProvider>
          <StatusBar style="light" backgroundColor={COLORS.bg} />
          <AuthenticatedNavigator />
        </EmergencyProvider>
      </AuthProvider>
    </NavigationContainer>
  );
}
