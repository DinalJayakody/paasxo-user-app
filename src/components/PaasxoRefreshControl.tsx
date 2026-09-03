import React from 'react';
import { RefreshControl, RefreshControlProps } from 'react-native';
import { useTheme } from '../context/ThemeContext';

/**
 * Native RefreshControl can't have its spinner graphic replaced with a
 * custom image on either platform — that's a hard platform limitation, not
 * a missing prop. So the actual Paasxo-logo animation lives in
 * `PaasxoRefreshLogo`, rendered as an absolutely-positioned overlay right
 * above wherever this is used (see any screen with pull-to-refresh for the
 * pairing); this component's only job is to make the *native* spinner a
 * soft brand-blue hint while dragging, so it doesn't visually clash once the
 * logo overlay takes over — while still using the real native gesture/
 * rubber-band physics, which is worth far more to the feel of this than any
 * custom-drawn graphic would be.
 */
export function PaasxoRefreshControl(props: Omit<RefreshControlProps, 'tintColor' | 'colors' | 'progressBackgroundColor'>) {
  const { colors } = useTheme();
  return (
    <RefreshControl
      {...props}
      tintColor={colors.primaryLight}
      colors={[colors.primary]}
      progressBackgroundColor={colors.cardBg}
    />
  );
}
