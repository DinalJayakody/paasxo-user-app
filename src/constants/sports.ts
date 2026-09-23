import { Trophy, Users, Dumbbell, Activity, Footprints, PersonStanding, Route, LucideIcon } from 'lucide-react-native';

// Mirrors com.pasxo.dto.enums.Sport on the backend (minus FOOTBALL, which
// isn't offered as a selectable activity in this app yet).
export interface SportOption {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const SPORTS: SportOption[] = [
  { id: 'FUTSAL', label: 'Futsal', icon: Users },
  { id: 'CRICKET', label: 'Cricket', icon: Trophy },
  { id: 'PICKLEBALL', label: 'Pickleball', icon: Dumbbell },
  { id: 'PADDLEBALL', label: 'Paddleball', icon: Activity },
  { id: 'TRAINER_GYM', label: 'Trainer (Gym)', icon: Dumbbell },
  { id: 'GYM', label: 'Gym', icon: PersonStanding },
  { id: 'WALKING', label: 'Walking', icon: Footprints },
  { id: 'RUNNING', label: 'Running', icon: Route },
];
