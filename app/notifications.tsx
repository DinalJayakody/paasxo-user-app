import { useLocalSearchParams } from 'expo-router';
import NotificationScreen from '../src/screens/NotificationScreen';
import { NotificationCategory } from '../src/api/notificationApi';

export default function NotificationsRoute() {
  const params = useLocalSearchParams<{ category?: string }>();
  const category = params.category === 'SOCIAL' || params.category === 'GENERAL'
    ? (params.category as NotificationCategory)
    : undefined;

  return <NotificationScreen category={category} />;
}
