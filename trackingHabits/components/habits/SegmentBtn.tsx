import React from 'react';
import { Pressable, View } from 'react-native';
import type { Palette } from './utils';

export function SegmentBtn({
  icon, active, onPress, C,
}: {
  icon: React.ReactNode;
  active?: boolean;
  onPress?: () => void;
  C: Palette;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 8,
          backgroundColor: active ? C.primary : C.card,
          borderWidth: 1,
          borderColor: active ? 'transparent' : C.border,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
      accessibilityRole="button"
    >
      <View style={{ minWidth: 28, alignItems: 'center' }}>{icon}</View>
    </Pressable>
  );
}
