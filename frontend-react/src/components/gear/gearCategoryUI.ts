import {
  Cable, Shield, Footprints, Anchor,
  Lock, RotateCw, Square, Link, Link2, Circle, Package,
} from 'lucide-react';
import type { GearCategory } from '@/types';

export const CATEGORY_ICONS: Record<GearCategory, typeof Package> = {
  rope:       Cable,
  quickdraw:  Link,
  belay_auto: Anchor,
  belay_tube: Circle,
  harness:    Shield,
  shoes:      Footprints,
  carabiner:  Lock,
  machard:    RotateCw,
  crashpad:   Square,
  quicklink:  Link2,
};

export const CATEGORY_BG: Record<GearCategory, string> = {
  rope:       'from-blue-50 to-blue-100 dark:from-blue-950/40 dark:to-blue-900/30',
  quickdraw:  'from-orange-50 to-orange-100 dark:from-orange-950/40 dark:to-orange-900/30',
  belay_auto: 'from-purple-50 to-purple-100 dark:from-purple-950/40 dark:to-purple-900/30',
  belay_tube: 'from-cyan-50 to-cyan-100 dark:from-cyan-950/40 dark:to-cyan-900/30',
  harness:    'from-rose-50 to-rose-100 dark:from-rose-950/40 dark:to-rose-900/30',
  shoes:      'from-amber-50 to-amber-100 dark:from-amber-950/40 dark:to-amber-900/30',
  carabiner:  'from-slate-50 to-slate-100 dark:from-slate-950/40 dark:to-slate-900/30',
  machard:    'from-green-50 to-green-100 dark:from-green-950/40 dark:to-green-900/30',
  crashpad:   'from-teal-50 to-teal-100 dark:from-teal-950/40 dark:to-teal-900/30',
  quicklink:  'from-indigo-50 to-indigo-100 dark:from-indigo-950/40 dark:to-indigo-900/30',
};

export const CATEGORY_ICON_COLOR: Record<GearCategory, string> = {
  rope:       'text-blue-400',
  quickdraw:  'text-orange-400',
  belay_auto: 'text-purple-400',
  belay_tube: 'text-cyan-400',
  harness:    'text-rose-400',
  shoes:      'text-amber-400',
  carabiner:  'text-slate-400',
  machard:    'text-green-400',
  crashpad:   'text-teal-400',
  quicklink:  'text-indigo-400',
};
