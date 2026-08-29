import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { Colors } from '../styles/colors';
import { TrainerSessionSlot } from '../types/api';

interface Props {
  visible: boolean;
  onClose: () => void;
  slots: TrainerSessionSlot[];
  selectedSlotId: number | null;
  onSelectSlot: (slotId: number) => void;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_FORMATTER = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function AvailabilityCalendarModal({ visible, onClose, slots, selectedSlotId, onSelectSlot }: Props) {
  const today = useMemo(() => new Date(new Date().toDateString()), []);
  const selectedSlot = slots.find((s) => s.id === selectedSlotId) ?? null;
  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(selectedSlot ? new Date(selectedSlot.slotDate + 'T00:00:00') : today)
  );

  // Group slots by date — a date can only be picked if it has at least one
  // non-full slot; the first such slot on that date is what gets selected.
  const slotsByDate = useMemo(() => {
    const map = new Map<string, TrainerSessionSlot[]>();
    slots.forEach((s) => {
      const list = map.get(s.slotDate) ?? [];
      list.push(s);
      map.set(s.slotDate, list);
    });
    return map;
  }, [slots]);

  const availableDates = useMemo(() => {
    const dates = Array.from(slotsByDate.keys());
    return dates.length ? dates.sort() : [];
  }, [slotsByDate]);

  const minMonth = startOfMonth(today);
  const maxMonth = availableDates.length
    ? startOfMonth(new Date(availableDates[availableDates.length - 1] + 'T00:00:00'))
    : minMonth;

  const canGoPrev = viewMonth.getTime() > minMonth.getTime();
  const canGoNext = viewMonth.getTime() < maxMonth.getTime();

  const weeks = useMemo(() => {
    const first = startOfMonth(viewMonth);
    const firstWeekday = first.getDay();
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = Array(firstWeekday).fill(null);
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [viewMonth]);

  const handleDayPress = (date: Date) => {
    const iso = toIsoDate(date);
    const daySlots = slotsByDate.get(iso);
    if (!daySlots?.length) return;
    const pick = daySlots.find((s) => s.status === 'OPEN') ?? daySlots[0];
    onSelectSlot(pick.id);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheetWrap} onPress={(e) => e.stopPropagation()}>
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Pick a Date</Text>
              <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.closeBtn}>
                <X color={Colors.textSecondary} size={20} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            <View style={styles.monthNav}>
              <TouchableOpacity
                disabled={!canGoPrev}
                onPress={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
                style={[styles.monthNavBtn, !canGoPrev && styles.monthNavBtnDisabled]}
                hitSlop={8}
              >
                <ChevronLeft color={canGoPrev ? Colors.text : Colors.neutral300} size={20} strokeWidth={2.4} />
              </TouchableOpacity>
              <Text style={styles.monthLabel}>{MONTH_FORMATTER.format(viewMonth)}</Text>
              <TouchableOpacity
                disabled={!canGoNext}
                onPress={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
                style={[styles.monthNavBtn, !canGoNext && styles.monthNavBtnDisabled]}
                hitSlop={8}
              >
                <ChevronRight color={canGoNext ? Colors.text : Colors.neutral300} size={20} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            <View style={styles.weekdayRow}>
              {WEEKDAY_LABELS.map((w, i) => (
                <Text key={i} style={styles.weekdayLabel}>{w}</Text>
              ))}
            </View>

            {weeks.map((week, wi) => (
              <View key={wi} style={styles.weekRow}>
                {week.map((date, di) => {
                  if (!date) return <View key={di} style={styles.dayCell} />;
                  const iso = toIsoDate(date);
                  const daySlots = slotsByDate.get(iso);
                  const hasOpenSlot = daySlots?.some((s) => s.status === 'OPEN');
                  const isFullOnly = !!daySlots?.length && !hasOpenSlot;
                  const isAvailable = !!hasOpenSlot;
                  const isPast = date.getTime() < today.getTime();
                  const isSelected = selectedSlot?.slotDate === iso;
                  const isToday = toIsoDate(today) === iso;
                  return (
                    <TouchableOpacity
                      key={di}
                      disabled={!isAvailable || isPast}
                      onPress={() => handleDayPress(date)}
                      style={[
                        styles.dayCell,
                        isAvailable && styles.dayCellAvailable,
                        isSelected && styles.dayCellSelected,
                      ]}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          (isPast || (!isAvailable && !isFullOnly)) && styles.dayTextMuted,
                          isFullOnly && styles.dayTextFull,
                          isAvailable && styles.dayTextAvailable,
                          isSelected && styles.dayTextSelected,
                        ]}
                      >
                        {date.getDate()}
                      </Text>
                      {isToday && !isSelected && <View style={styles.todayDot} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.trainerLight, borderColor: Colors.trainer }]} />
                <Text style={styles.legendText}>Available</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.neutral100, borderColor: Colors.neutral200 }]} />
                <Text style={styles.legendText}>Full / unavailable</Text>
              </View>
            </View>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  sheetWrap: {},
  sheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.neutral100,
    alignItems: 'center', justifyContent: 'center',
  },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  monthNavBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.neutral100,
    alignItems: 'center', justifyContent: 'center',
  },
  monthNavBtnDisabled: { opacity: 0.4 },
  monthLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekdayLabel: { flex: 1, textAlign: 'center', fontSize: 11.5, fontWeight: '700', color: Colors.textMuted },
  weekRow: { flexDirection: 'row' },
  dayCell: {
    flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
    marginVertical: 2, borderRadius: 12,
  },
  dayCellAvailable: { backgroundColor: Colors.trainerLight },
  dayCellSelected: { backgroundColor: Colors.trainer },
  dayText: { fontSize: 13.5, fontWeight: '600', color: Colors.text },
  dayTextMuted: { color: Colors.neutral300 },
  dayTextFull: { color: Colors.neutral400, textDecorationLine: 'line-through' },
  dayTextAvailable: { color: Colors.trainer, fontWeight: '800' },
  dayTextSelected: { color: Colors.white, fontWeight: '800' },
  todayDot: {
    position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.primary,
  },
  legendRow: { flexDirection: 'row', gap: 20, marginTop: 14, marginBottom: 8, paddingLeft: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5 },
  legendText: { fontSize: 11.5, color: Colors.textSecondary, fontWeight: '600' },
});
