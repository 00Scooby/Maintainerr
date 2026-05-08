import z from 'zod'
import { DEFAULT_FRAME_CONFIG, frameConfigSchema } from './frame-config'
import {
  DEFAULT_OVERLAY_STYLE_CONFIG,
  overlayStyleConfigSchema,
} from './overlay-style-config'
import {
  DEFAULT_OVERLAY_TEXT_CONFIG,
  overlayTextConfigSchema,
} from './overlay-text-config'

export const overlaySettingsSchema = z.object({
  enabled: z.boolean(),
  posterOverlayText: overlayTextConfigSchema,
  posterOverlayStyle: overlayStyleConfigSchema,
  posterFrame: frameConfigSchema,
  titleCardOverlayText: overlayTextConfigSchema,
  titleCardOverlayStyle: overlayStyleConfigSchema,
  titleCardFrame: frameConfigSchema,
  cronSchedule: z.string().nullable(),

  // --- Kometa Export Settings (Abgesichert für Altdaten & frische DBs) ---
  kometaEnabled: z.boolean().catch(false).default(false),
  kometaUrgentDays: z.number().catch(3).default(3),
  kometaUrgentColor: z.string().catch('#E31E24').default('#E31E24'),
  kometaWarningDays: z.number().catch(10).default(10),
  kometaWarningColor: z.string().catch('#F1C40F').default('#F1C40F'),
  kometaTextColor: z.string().catch('#FFFFFF').default('#FFFFFF'),
  kometaBannerX: z.number().int().default(16),
  kometaBannerY: z.number().int().default(16),
  kometaBannerW: z.number().int().min(1).default(120),
  kometaBannerH: z.number().int().min(1).default(32),
})

export const overlaySettingsUpdateSchema = overlaySettingsSchema.partial()

export type OverlaySettings = z.infer<typeof overlaySettingsSchema>
export type OverlaySettingsUpdate = z.infer<typeof overlaySettingsUpdateSchema>

export const DEFAULT_OVERLAY_SETTINGS: OverlaySettings = {
  enabled: false,
  posterOverlayText: DEFAULT_OVERLAY_TEXT_CONFIG,
  posterOverlayStyle: DEFAULT_OVERLAY_STYLE_CONFIG,
  posterFrame: DEFAULT_FRAME_CONFIG,
  titleCardOverlayText: DEFAULT_OVERLAY_TEXT_CONFIG,
  titleCardOverlayStyle: DEFAULT_OVERLAY_STYLE_CONFIG,
  titleCardFrame: DEFAULT_FRAME_CONFIG,
  cronSchedule: null,

  // --- Kometa Defaults ---
  kometaEnabled: false,
  kometaUrgentDays: 3,
  kometaUrgentColor: '#E31E24',
  kometaWarningDays: 10,
  kometaWarningColor: '#F1C40F',
  kometaTextColor: '#FFFFFF',
  kometaBannerX: 16,
  kometaBannerY: 16,
  kometaBannerW: 120,
  kometaBannerH: 32,
}

export const overlayExportSchema = z.object({
  version: z.literal(1),
  overlayText: overlayTextConfigSchema,
  overlayStyle: overlayStyleConfigSchema,
  frame: frameConfigSchema,
})

export type OverlayExport = z.infer<typeof overlayExportSchema>
