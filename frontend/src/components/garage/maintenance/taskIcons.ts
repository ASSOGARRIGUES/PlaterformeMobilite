import {
  IconBattery,
  IconBolt,
  IconBulb,
  IconCar,
  IconCircleDot,
  IconCircles,
  IconDisc,
  IconDroplet,
  IconEngine,
  IconFilter,
  IconSettings,
  IconSteeringWheel,
  IconTool,
  IconWind,
} from '@tabler/icons-react'
import { IconEnum } from '../../../types/schema.d'

type TaskIconComponent = typeof IconTool

/** Icône Tabler de chaque clé TaskCatalog.icon (backend : ICON_CHOICES). */
const TASK_ICONS: Record<IconEnum, TaskIconComponent> = {
  [IconEnum.tool]: IconTool,
  [IconEnum.oil]: IconDroplet,
  [IconEnum.filter]: IconFilter,
  [IconEnum.air]: IconWind,
  [IconEnum.belt]: IconSettings,
  [IconEnum.brake]: IconDisc,
  [IconEnum.tire]: IconCircleDot,
  [IconEnum.spark]: IconBolt,
  [IconEnum.bearing]: IconCircles,
  [IconEnum.steering]: IconSteeringWheel,
  [IconEnum.battery]: IconBattery,
  [IconEnum.light]: IconBulb,
  [IconEnum.engine]: IconEngine,
  [IconEnum.body]: IconCar,
}

export function taskIcon(icon: string | null | undefined): TaskIconComponent {
  return TASK_ICONS[icon as IconEnum] ?? IconTool
}
