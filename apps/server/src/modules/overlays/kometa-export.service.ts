import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml'; // Maintainerr nutzt dieses Paket bereits für den Rule-Import
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
    // Hier legen wir den Ordner fest, den User später in Docker mounten können
    this.exportDir = path.join(configDataDir, 'kometa_overlays');
  }

  /**
   * Dies ist die Hauptfunktion, die später nach dem normalen Overlay-Prozess aufgerufen wird.
   */
  async generateExport(collectionsData: any[]) {
    const settings = await this.settingsService.getSettings();

    // Wenn der User Kometa-Export nicht aktiviert hat, machen wir gar nichts
    if (!settings.kometaEnabled) {
      return;
    }

    this.logger.log('Starting Kometa YAML export...');

    // Stelle sicher, dass der Export-Ordner existiert
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }

    // --- HIER KOMMT DANN DEINE PYTHON-LOGIK REIN ---
    // Wir bauen das später weiter aus, aber hier ist schon mal ein Dummy-Test!

    const kometaExports: Record<string, any> = {
      templates: {
        days_left_banner: {
          overlay: {
            name: 'text(<<banner_text>>)',
            back_color: '<<color>>',
            font_color: '<<font_color>>',
            // etc...
          },
        },
      },
      overlays: {},
    };

    // Datei schreiben
    try {
      const exportPath = path.join(this.exportDir, 'maintainerr_overlays.yml');
      const yamlString = yaml.stringify(kometaExports);

      fs.writeFileSync(exportPath, yamlString, 'utf-8');
      this.logger.log(
        `Kometa overlay file successfully generated at: ${exportPath}`,
      );
    } catch (error) {
      this.logger.error(`Failed to generate Kometa export: ${error.message}`);
    }
  }
}
