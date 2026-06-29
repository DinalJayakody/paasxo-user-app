import { useLocalSearchParams } from 'expo-router';
import JoinMatchScreen from '../../src/screens/JoinMatchScreen';

export default function JoinMatchRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <JoinMatchScreen matchId={id} />;
}
