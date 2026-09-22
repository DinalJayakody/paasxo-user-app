import { useEffect } from 'react';
import { Link, Stack, usePathname } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Diagnostic-only addition: shows/logs the actual path that failed to
 * match a route. Without this there's no way to tell WHICH navigation
 * attempt landed here — every unmatched route renders the exact same
 * "This screen doesn't exist" with nothing to go on. Purely additive (a
 * console.warn plus one extra line of text); doesn't change routing
 * behavior at all.
 */
export default function NotFoundScreen() {
  const pathname = usePathname();

  useEffect(() => {
    console.warn('[+not-found] no route matched:', pathname);
  }, [pathname]);

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.text}>This screen doesn't exist.</Text>
        <Text style={styles.path} selectable>{pathname}</Text>
        <Link href="/" style={styles.link}>
          <Text>Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  text: {
    fontSize: 20,
    fontWeight: 600,
  },
  path: {
    marginTop: 8,
    fontSize: 13,
    color: '#888',
    fontFamily: 'monospace',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
