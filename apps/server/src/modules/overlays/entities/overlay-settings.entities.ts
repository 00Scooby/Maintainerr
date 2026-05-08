import {
  FrameConfig,
  OverlayStyleConfig,
  OverlayTextConfig,
} from '@maintainerr/contracts';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('overlay_settings')
export class OverlaySettingsEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: false })
  enabled: boolean;

  @Column({ type: 'simple-json' })
  posterOverlayText: OverlayTextConfig;

  @Column({ type: 'simple-json' })
  posterOverlayStyle: OverlayStyleConfig;

  @Column({ type: 'simple-json' })
  posterFrame: FrameConfig;

  @Column({ type: 'simple-json' })
  titleCardOverlayText: OverlayTextConfig;

  @Column({ type: 'simple-json' })
  titleCardOverlayStyle: OverlayStyleConfig;

  @Column({ type: 'simple-json' })
  titleCardFrame: FrameConfig;

  @Column({ type: 'varchar', nullable: true })
  cronSchedule: string | null;

  // --- NEU: Kometa Integration Columns ---
  @Column({ default: false })
  kometaEnabled: boolean;

  @Column({ default: 3 })
  kometaUrgentDays: number;

  @Column({ default: '#E31E24' })
  kometaUrgentColor: string;

  @Column({ default: 10 })
  kometaWarningDays: number;

  @Column({ default: '#F1C40F' })
  kometaWarningColor: string;

  @Column({ default: '#FFFFFF' })
  kometaTextColor: string;
}
