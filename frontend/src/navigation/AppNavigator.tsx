import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import { View, ActivityIndicator } from 'react-native';
import HomeScreen from '../screens/Home/HomeScreen';
import SettingsScreen from '../screens/Settings/SettingsScreen';
import AccountScreen from '../screens/Account/AccountScreen';
import WelcomeScreen from '../screens/Auth/Welcome/WelcomeScreen';
import LoginScreen from '../screens/Auth/Login/LoginScreen';
import RegisterScreen from '../screens/Auth/Register/RegisterScreen';
import { useAuth } from '../context/AuthContext';

export type RootStackParamList = {
  Home: { conversationId?: string } | undefined;
  Settings: undefined;
  Account: undefined;
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    console.log('[NAV] Showing Splash / Loading screen...');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#070913' }}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  if (!isAuthenticated) {
    console.log('[NAV] Showing Welcome/Auth stack (unauthenticated)');
  } else {
    console.log('[NAV] Showing Main stack (authenticated as', user?.email || user?.name, ')');
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#070913' },
        }}
      >
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Account" component={AccountScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
