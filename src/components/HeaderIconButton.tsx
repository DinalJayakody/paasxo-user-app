import React, { useRef } from 'react';
import { Pressable, Animated, StyleProp, ViewStyle } from 'react-native';

interface HeaderIconButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
}

/** Circular icon button used in floating headers (bell, search, settings,
 *  back arrow...) — a spring scale-down on press stands in for "hover" since
 *  touch devices have no pointer-hover state. Purely a visual wrapper: the
 *  `onPress` behavior is whatever the caller already had. */
export default function HeaderIconButton({ onPress, children, style, hitSlop = 6 }: HeaderIconButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} hitSlop={hitSlop}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
