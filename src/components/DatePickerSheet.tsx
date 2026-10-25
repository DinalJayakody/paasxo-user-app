import React, { useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../styles/colors';

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** Month-grid date picker sheet (Monday-first, past days disabled). */
export function DatePickerSheet({
  visible,
  onClose,
  onSelect,
  selectedDate,
  title = 'Pick a Date',
  maxDate,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (d: Date) => void;
  selectedDate: Date | null;
  title?: string;
  /** Last selectable day (inclusive); later days are greyed out. */
  maxDate?: Date;
}) {
  const { colors } = useTheme();
  const calStyles = React.useMemo(() => createCalStyles(colors), [colors]);
  const today = new Date();
  const [viewDate, setViewDate] = useState<Date>(() => {
    const d = selectedDate ?? today;
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    if (visible) {
      const d = selectedDate ?? today;
      setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [visible]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayJS = new Date(year, month, 1).getDay(); // 0=Sun
  const startOffset = (firstDayJS + 6) % 7; // Mon=0

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  // "past" = not selectable: before today, or after maxDate.
  const isPast = (day: number) => {
    const d = new Date(year, month, day);
    d.setHours(0, 0, 0, 0);
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    if (d < t) return true;
    if (maxDate) {
      const m = new Date(maxDate);
      m.setHours(0, 0, 0, 0);
      if (d > m) return true;
    }
    return false;
  };
  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getFullYear() === year &&
      selectedDate.getMonth() === month &&
      selectedDate.getDate() === day
    );
  };
  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={calStyles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
        <View style={calStyles.sheet}>
          <View style={calStyles.handle} />
          <Text style={calStyles.title}>{title}</Text>

          {/* Month nav */}
          <View style={calStyles.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={calStyles.navBtn} activeOpacity={0.7} accessibilityLabel="Previous month">
              <ChevronLeft color={colors.primary} size={20} strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={calStyles.monthLabel}>{monthLabel}</Text>
            <TouchableOpacity onPress={nextMonth} style={calStyles.navBtn} activeOpacity={0.7} accessibilityLabel="Next month">
              <ChevronRight color={colors.primary} size={20} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {/* Day-of-week header */}
          <View style={calStyles.weekRow}>
            {DAY_LABELS.map((d) => (
              <Text key={d} style={calStyles.weekLabel}>{d}</Text>
            ))}
          </View>

          {/* Date grid */}
          <View style={calStyles.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={`empty-${i}`} style={calStyles.cell} />;
              const past = isPast(day);
              const sel = isSelected(day);
              const tod = isToday(day);
              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    calStyles.cell,
                    sel && calStyles.cellSelected,
                    tod && !sel && calStyles.cellToday,
                    past && calStyles.cellPast,
                  ]}
                  onPress={() => {
                    if (!past) {
                      onSelect(new Date(year, month, day));
                      onClose();
                    }
                  }}
                  activeOpacity={past ? 1 : 0.7}
                >
                  <Text
                    style={[
                      calStyles.cellText,
                      sel && calStyles.cellTextSelected,
                      tod && !sel && calStyles.cellTextToday,
                      past && calStyles.cellTextPast,
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createCalStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: colors.cardBg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24, paddingTop: 12 },
  handle: { width: 40, height: 4, backgroundColor: colors.neutral300, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 20 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 20, marginVertical: 2 },
  cellSelected: { backgroundColor: colors.primary },
  cellToday: { backgroundColor: colors.primaryLight },
  cellPast: { opacity: 0.3 },
  cellText: { fontSize: 14, fontWeight: '600', color: colors.text },
  cellTextSelected: { color: colors.white, fontWeight: '800' },
  cellTextToday: { color: colors.primary, fontWeight: '800' },
  cellTextPast: { color: colors.textMuted },
});
