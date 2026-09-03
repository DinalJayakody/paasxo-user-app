import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { HeartPulse, Clock, Droplets, Shirt } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { TrainerCategory } from '../types/api';

const EQUIPMENT_TIP: Record<TrainerCategory, string> = {
  GYM: 'Wear closed-toe athletic shoes and comfortable workout clothing.',
  CALISTHENICS: 'Wear flexible activewear and closed-toe shoes for a good grip.',
  CROSSFIT: 'Wear supportive athletic shoes and clothing you can move freely in.',
  YOGA: 'Bring your own mat if you have one, and wear comfortable, stretchy clothing.',
  PILATES: 'Bring a mat and wear fitted, comfortable clothing.',
  DANCING: 'Wear comfortable shoes suited for movement and breathable clothing.',
  MARTIAL_ARTS: 'Wear appropriate training attire — your trainer will advise on any protective gear.',
  OTHER: 'Wear comfortable clothing suited for physical activity.',
};

export interface GuidelineItem {
  Icon: any;
  title: string;
  description: string;
}

export function getSessionGuidelines(category: TrainerCategory): GuidelineItem[] {
  return [
    {
      Icon: HeartPulse,
      title: 'Health & injuries',
      description: 'Tell your trainer about any injuries, health conditions, or physical limitations before you start.',
    },
    {
      Icon: Clock,
      title: 'Be on time',
      description: 'Arrive 5–10 minutes early — sessions already in progress may not be able to fit you in.',
    },
    {
      Icon: Droplets,
      title: 'Bring water & a towel',
      description: 'Stay hydrated and keep a towel handy — you\'ll want both.',
    },
    {
      Icon: Shirt,
      title: 'What to wear',
      description: EQUIPMENT_TIP[category] ?? EQUIPMENT_TIP.OTHER,
    },
  ];
}

interface Props {
  category: TrainerCategory;
  variant?: 'compact' | 'full';
}

export function SessionGuidelines({ category, variant = 'full' }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const items = getSessionGuidelines(category);
  const visible = variant === 'compact' ? items.slice(0, 2) : items;

  return (
    <View style={styles.list}>
      {visible.map((item) => (
        <View key={item.title} style={styles.row}>
          <View style={styles.iconWrap}>
            <item.Icon color={colors.trainer} size={17} strokeWidth={2.2} />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemDesc}>{item.description}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  list: { gap: 14 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  flex1: { flex: 1 },
  iconWrap: {
    width: 34, height: 34, borderRadius: 11, backgroundColor: colors.trainerLight,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  itemTitle: { fontSize: 13.5, fontWeight: '700', color: colors.text, marginBottom: 2 },
  itemDesc: { fontSize: 12.5, color: colors.textSecondary, lineHeight: 18 },
});
