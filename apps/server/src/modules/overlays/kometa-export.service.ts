import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { dataDir as configDataDir } from '../../app/config/dataDir';
import { MaintainerrLogger } from '../logging/logs.service';
import { OverlaySettingsService } from './overlay-settings.service';

@Injectable()
export class KometaExportService {
  private readonly exportDir: string;

  constructor(
    private readonly settingsService: OverlaySettingsService,
    private readonly logger: MaintainerrLogger,
  ) {
    this.logger.setContext(KometaExportService.name);
    this.exportDir = path.join(configDataDir, 'kometa_overlays');
  }

  /**
   * Berechnet die verbleibenden Tage analog zu deinem Python-Skript
   */
  private calculateDaysLeft(item: any, deleteAfterDays: number): number {
    // 1. Prio: Falls Maintainerr den Wert schon direkt mitliefert
    if (item.daysLeft !== undefined && item.daysLeft !== null) {
      return Math.max(0, Number(item.daysLeft));
    }

    // 2. Prio: Manuelle Berechnung via addDate
    const rawDate = item.addDate || item.addedAt;
    if (!rawDate) return 0;

    const addDt = new Date(rawDate);
    const now = new Date();

    // Differenz in Tagen berechnen
    const diffTime = Math.abs(now.getTime() - addDt.getTime());
    const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const daysLeft = deleteAfterDays - daysPassed;

    return Math.max(0, daysLeft);
  }

  async generateExport(collectionsData: any[]) {
    const settings = await this.settingsService.getSettings();

    if (!settings.kometaEnabled) {
      return;
    }

    this.logger.log('Starting Kometa YAML export...');

    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }

    // Basis-Design für Kometa
    const overlayDesign = {
      name: 'text(<<banner_text>>)',
      horizontal_align: 'left',
      vertical_align: 'top',
      horizontal_offset: 20,
      vertical_offset: 20,
      back_color: '<<color>>',
      font_color: '<<font_color>>',
      back_radius: 20,
      font_size: 55,
      back_width: 380,
      back_height: 85,
    };

    // Unsere Datenstruktur für den Export
    const kometaExport: any = {
      templates: {
        days_left_banner: {
          plex_search: { title: '<<item_title>>' },
          overlay: { ...overlayDesign },
        },
      },
      overlays: {},
    };

    let itemsProcessed = 0;

    // Iteriere durch alle Collections, die Overlay aktiviert haben
    for (const coll of collectionsData) {
      const deleteDays = coll.deleteAfterDays || 30;

      if (!coll.collectionMedia || !Array.isArray(coll.collectionMedia)) {
        continue;
      }

      for (const item of coll.collectionMedia) {
        // Da Maintainerr intern die MediaServerId speichert
        if (!item.mediaServerId) continue;

        const daysLeft = this.calculateDaysLeft(item, deleteDays);

        // Threshold-Logik anwenden
        let currentColor = settings.kometaWarningColor;
        if (daysLeft <= settings.kometaUrgentDays) {
          currentColor = settings.kometaUrgentColor;
        }

        const tagWort = daysLeft === 1 ? 'Tag' : 'Tage';
        const finalBannerText = `Noch ${daysLeft} ${tagWort}`;

        // Wir nutzen die mediaServerId als Fallback, falls der Title nicht direkt im Objekt liegt
        // (Für eine noch genauere Titel-Auflösung müssten wir den Plex-Provider anfunken,
        // aber für den Kometa-Match reicht oft auch die ID oder ein Platzhalter, wenn Maintainerr
        // den Titel nicht im Cache hat).
        const itemTitle = item.title || `Media ID ${item.mediaServerId}`;

        kometaExport.overlays[itemTitle] = {
          template: {
            name: 'days_left_banner',
            item_title: itemTitle,
            banner_text: finalBannerText,
            color: currentColor,
            font_color: settings.kometaTextColor,
          },
        };
        itemsProcessed++;
      }
    }

    try {
      // Wir generieren eine Master-Datei
      const exportPath = path.join(this.exportDir, 'maintainerr_overlays.yml');
      const yamlString = yaml.stringify(kometaExport);

      fs.writeFileSync(exportPath, yamlString, 'utf-8');
      this.logger.log(
        `Kometa overlay file successfully generated at: ${exportPath} with ${itemsProcessed} overlays.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to generate Kometa export: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
