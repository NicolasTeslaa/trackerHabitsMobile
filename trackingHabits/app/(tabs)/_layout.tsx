import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import React from 'react';

import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.tint,
        headerShown: useClientOnlyValue(false, true),
        headerTitleAlign: 'left',
        headerTintColor: theme.text,
        tabBarLabelStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Seus hábitos',          // título do header
          tabBarLabel: 'Hábitos',         // rótulo da aba
          tabBarIcon: ({ color }) => <TabBarIcon name="calendar" color={color} />,
          // Removi o headerRight com o link pra /modal; recoloque se precisar
        }}
      />

      <Tabs.Screen
        name="two"
        options={{
          title: 'Insights e métricas',
          tabBarLabel: 'Insights',
          tabBarIcon: ({ color }) => (
            <Ionicons name="analytics" size={30} color={color} style={{ marginBottom: -3 }} />
          ),
        }}
      />
    </Tabs>
  );
}
