import { StyleSheet } from 'react-native';

export const Typography = StyleSheet.create({
  h1: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
  },
  h4: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
  },
  bodyLg: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  body: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 22,
  },
  bodySm: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  caption: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
});
