import {
  isSafeFilename,
  OVERLAY_IMAGE_EXTENSIONS,
  OVERLAY_IMAGE_FORMATS,
  OVERLAY_IMAGE_MAX_BYTES,
  OVERLAY_IMAGE_MAX_LABEL,
  OverlayElement,
  OverlayLibrarySection,
  OverlayPreviewItem,
  type OverlayProcessRequest,
  overlayProcessRequestSchema,
  OverlaySettings,
  OverlaySettingsUpdate,
  overlaySettingsUpdateSchema,
  OverlayTemplateCreate,
  overlayTemplateCreateSchema,
  overlayTemplateExportSchema,
  OverlayTemplateUpdate,
  overlayTemplateUpdateSchema,
  sanitizeFilenameChars,
} from '@maintainerr/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  ServiceUnavailableException,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as fs from 'fs';
import { ZodValidationPipe } from 'nestjs-zod';
import * as path from 'path';
import sharp from 'sharp';
import { dataDir as configDataDir } from '../../app/config/dataDir';
import { MediaServerSetupGuard } from '../api/media-server/guards/media-server-setup.guard';
import { MediaServerFactory } from '../api/media-server/media-server.factory';
import { CollectionsService } from '../collections/collections.service';
import { MaintainerrLogger } from '../logging/logs.service';
import { OverlayProcessorService } from './overlay-processor.service';
import { OverlaySettingsService } from './overlay-settings.service';
import { OverlayTaskService } from './overlay-task.service';
import { OverlayTemplateService } from './overlay-template.service';
import { OverlayProviderFactory } from './providers/overlay-provider.factory';
import { IOverlayProvider } from './providers/overlay-provider.interface';

@Controller('api/overlays')
@UseGuards(MediaServerSetupGuard)
export class OverlaysController {
  private readonly fontsDir: string;
  private readonly fontContentTypes = new Map<string, string>([
    ['.ttf', 'font/ttf'],
    ['.otf', 'font/otf'],
    ['.woff', 'font/woff'],
  ]);
  // Driven from the shared OVERLAY_IMAGE_FORMATS contract so any added
  // extension lights up the server validation and the UI picker together.
  private readonly imageContentTypes = new Map<string, string>(
    OVERLAY_IMAGE_FORMATS.map((f) => [f.extension, f.mime] as const),
  );

  constructor(
    private readonly settingsService: OverlaySettingsService,
    private readonly processorService: OverlayProcessorService,
    private readonly taskService: OverlayTaskService,
    private readonly templateService: OverlayTemplateService,
    private readonly providerFactory: OverlayProviderFactory,
    private readonly collectionsService: CollectionsService,
    private readonly logger: MaintainerrLogger,
    private readonly mediaServerFactory: MediaServerFactory,
  ) {
    this.logger.setContext(OverlaysController.name);
    // Bundled fonts: check dist/assets/fonts first, then source assets/fonts for dev mode
    const distFonts = path.join(__dirname, '..', '..', 'assets', 'fonts');
    const srcFonts = path.join(__dirname, '..', '..', '..', 'assets', 'fonts');
    this.fontsDir = fs.existsSync(distFonts) ? distFonts : srcFonts;
  }

  /**
   * Resolve the overlay provider for the configured media server. The class
   * is gated by MediaServerSetupGuard so the happy path always finds one;
   * the null branch is defence-in-depth for a race with a server switch.
   */
  private async requireProvider(): Promise<IOverlayProvider> {
    const provider = await this.providerFactory.getProvider();
    if (!provider) {
      throw new ServiceUnavailableException(
        'Overlays are not available right now.',
      );
    }
    return provider;
  }

  // ── Settings ────────────────────────────────────────────────────────────

  @Get('settings')
  async getSettings(): Promise<OverlaySettings> {
    return this.settingsService.getSettings();
  }

  @Put('settings')
  async updateSettings(
    @Body(new ZodValidationPipe(overlaySettingsUpdateSchema))
    dto: OverlaySettingsUpdate,
  ): Promise<OverlaySettings> {
    const updated = await this.settingsService.updateSettings(dto);

    // If cron or enabled changed, update the scheduled job
    if (dto.cronSchedule !== undefined || dto.enabled !== undefined) {
      await this.taskService.updateCronSchedule(
        updated.cronSchedule,
        updated.enabled,
      );
    }

    return updated;
  }

  // ── Media server helpers (for preview UI) ───────────────────────────────

  @Get('sections')
  async getSections(): Promise<OverlayLibrarySection[]> {
    const provider = await this.requireProvider();
    return provider.getSections();
  }

  @Get('random-item')
  async getRandomItem(
    @Query('sectionId') sectionId: string,
  ): Promise<OverlayPreviewItem | null> {
    if (!sectionId) {
      throw new HttpException('sectionId is required', HttpStatus.BAD_REQUEST);
    }
    const provider = await this.requireProvider();
    return provider.getRandomItem([sectionId]);
  }

  @Get('random-episode')
  async getRandomEpisode(
    @Query('sectionId') sectionId: string,
  ): Promise<OverlayPreviewItem | null> {
    if (!sectionId) {
      throw new HttpException('sectionId is required', HttpStatus.BAD_REQUEST);
    }
    const provider = await this.requireProvider();
    return provider.getRandomEpisode([sectionId]);
  }

  @Get('poster')
  async getPoster(
    @Query('itemId') itemId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!itemId) {
      throw new HttpException('itemId is required', HttpStatus.BAD_REQUEST);
    }
    const provider = await this.requireProvider();
    const buf = await provider.downloadImage(itemId);
    if (!buf) {
      throw new HttpException('Poster not found', HttpStatus.NOT_FOUND);
    }
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return new StreamableFile(buf);
  }

  // ── Processing ──────────────────────────────────────────────────────────

  @Get('status')
  getStatus() {
    return {
      status: this.processorService.status,
      lastRun: this.processorService.lastRun,
      lastResult: this.processorService.lastResult,
    };
  }

  @Post('process')
  async processAll(
    @Body(new ZodValidationPipe(overlayProcessRequestSchema))
    request: OverlayProcessRequest,
  ) {
    if (this.processorService.status === 'running') {
      throw new HttpException(
        'Overlay processing is already running',
        HttpStatus.CONFLICT,
      );
    }
    const result = await this.processorService.processAllCollections(
      request.force ?? false,
    );
    return result;
  }

  @Post('process/:collectionId')
  async processCollection(
    @Param('collectionId', ParseIntPipe) collectionId: number,
  ) {
    if (this.processorService.status === 'running') {
      throw new HttpException(
        'Overlay processing is already running',
        HttpStatus.CONFLICT,
      );
    }

    const collection =
      await this.collectionsService.getCollection(collectionId);
    if (!collection) {
      throw new HttpException('Collection not found', HttpStatus.NOT_FOUND);
    }

    // Ensure collectionMedia is loaded
    if (!collection.collectionMedia) {
      const media =
        await this.collectionsService.getCollectionMedia(collectionId);
      collection.collectionMedia = media ?? [];
    }

    const result = await this.processorService.processCollection(collection);
    return result;
  }

  @Post('revert/:collectionId')
  async revertCollection(
    @Param('collectionId', ParseIntPipe) collectionId: number,
  ) {
    await this.processorService.revertCollection(collectionId);
    return { success: true };
  }

  @Delete('reset')
  async resetAll() {
    if (this.processorService.status === 'running') {
      throw new HttpException(
        'Overlay processing is already running',
        HttpStatus.CONFLICT,
      );
    }
    await this.processorService.resetAllOverlays();
    return { success: true };
  }

  // ── Fonts ───────────────────────────────────────────────────────────────

  private resolveFontContentType(fileName: string): string | undefined {
    return this.fontContentTypes.get(path.extname(fileName).toLowerCase());
  }

  private isSupportedFontFile(fileName: string): boolean {
    return this.resolveFontContentType(fileName) !== undefined;
  }

  private findFontPath(
    name: string,
  ): { path: string; contentType: string } | null {
    const candidates = [
      path.join(configDataDir, 'overlays', 'fonts', name),
      path.join(this.fontsDir, name),
    ];

    for (const candidate of candidates) {
      const contentType = this.resolveFontContentType(candidate);
      if (fs.existsSync(candidate) && contentType) {
        return { path: candidate, contentType };
      }
    }

    return null;
  }

  @Get('fonts')
  listFonts() {
    // User-uploaded fonts take precedence over bundled fonts when names
    // collide, so the dropdown and the served file agree on a single source.
    const userFontsDir = path.join(configDataDir, 'overlays', 'fonts');
    const dirs = [userFontsDir, this.fontsDir];

    // Mirror the validation in `getFont` and the render service so the
    // picker can't surface manually-dropped files (e.g. with spaces) that
    // the GET endpoint would reject with 400.
    const byName = new Map<string, { name: string; path: string }>();
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      const files = fs
        .readdirSync(dir)
        .filter((f) => this.isSupportedFontFile(f) && isSafeFilename(f));
      for (const file of files) {
        if (!byName.has(file)) {
          byName.set(file, { name: file, path: path.join(dir, file) });
        }
      }
    }

    return Array.from(byName.values());
  }

  @Get('fonts/:name')
  getFont(
    @Param('name') name: string,
    @Res({ passthrough: true }) res: Response,
  ): StreamableFile {
    if (!isSafeFilename(name)) {
      throw new HttpException('Invalid font name', HttpStatus.BAD_REQUEST);
    }

    // Mirror `listFonts`: user-uploaded fonts win on name collisions.
    const font = this.findFontPath(name);

    if (!font) {
      throw new HttpException('Font not found', HttpStatus.NOT_FOUND);
    }

    res.setHeader('Content-Type', font.contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return new StreamableFile(fs.createReadStream(font.path));
  }

  @Post('fonts')
  @UseInterceptors(FileInterceptor('font'))
  async uploadFont(
    @UploadedFile() file: { originalname: string; buffer: Buffer },
  ) {
    if (!file) {
      throw new HttpException('No font file uploaded', HttpStatus.BAD_REQUEST);
    }

    if (!this.isSupportedFontFile(file.originalname)) {
      throw new HttpException(
        'Only .ttf, .otf, and .woff font files are supported',
        HttpStatus.BAD_REQUEST,
      );
    }

    const safeName = sanitizeFilenameChars(path.basename(file.originalname));
    if (!isSafeFilename(safeName)) {
      throw new HttpException('Invalid font filename', HttpStatus.BAD_REQUEST);
    }
    const userFontsDir = path.join(configDataDir, 'overlays', 'fonts');
    const destPath = path.join(userFontsDir, safeName);
    fs.writeFileSync(destPath, file.buffer);

    return { name: safeName, path: destPath };
  }

  // ── Images ──────────────────────────────────────────────────────────────

  private resolveImageContentType(fileName: string): string | undefined {
    return this.imageContentTypes.get(path.extname(fileName).toLowerCase());
  }

  private isSupportedImageFile(fileName: string): boolean {
    return this.resolveImageContentType(fileName) !== undefined;
  }

  private getImagesDir(): string {
    return path.join(configDataDir, 'overlays', 'images');
  }

  @Get('images')
  listImages() {
    const imagesDir = this.getImagesDir();
    if (!fs.existsSync(imagesDir)) return [];
    // Mirror the validation in `getImage` and the render service so the
    // picker can't surface manually-dropped files (e.g. with spaces) that
    // the GET endpoint would reject with 400.
    return fs
      .readdirSync(imagesDir)
      .filter((f) => this.isSupportedImageFile(f) && isSafeFilename(f))
      .map((name) => ({ name, path: path.join(imagesDir, name) }));
  }

  @Get('images/:name')
  getImage(
    @Param('name') name: string,
    @Res({ passthrough: true }) res: Response,
  ): StreamableFile {
    if (!isSafeFilename(name)) {
      throw new HttpException('Invalid image name', HttpStatus.BAD_REQUEST);
    }
    const contentType = this.resolveImageContentType(name);
    if (!contentType) {
      throw new HttpException('Unsupported image type', HttpStatus.BAD_REQUEST);
    }
    const filePath = path.join(this.getImagesDir(), name);
    if (!fs.existsSync(filePath)) {
      throw new HttpException('Image not found', HttpStatus.NOT_FOUND);
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache');
    return new StreamableFile(fs.createReadStream(filePath));
  }

  @Post('images')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: OVERLAY_IMAGE_MAX_BYTES },
    }),
  )
  async uploadImage(
    @UploadedFile() file: { originalname: string; buffer: Buffer } | undefined,
  ) {
    if (!file?.buffer?.length) {
      throw new HttpException('No image file uploaded', HttpStatus.BAD_REQUEST);
    }

    if (!this.isSupportedImageFile(file.originalname)) {
      throw new HttpException(
        `Only ${OVERLAY_IMAGE_EXTENSIONS.join(', ')} image files are supported`,
        HttpStatus.BAD_REQUEST,
      );
    }

    let detectedFormat: string | undefined;
    try {
      const meta = await sharp(file.buffer).metadata();
      detectedFormat = meta.format;
    } catch {
      throw new HttpException(
        'Uploaded file is not a valid image',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Reject extension/content mismatches: a PNG renamed to .jpg would
    // otherwise be served back with a Content-Type derived from the
    // extension, which is misleading and a small spoofing risk. Compare
    // sharp's detected format against the format expected for the
    // sanitized extension. Both sides use canonical names (jpeg/png/webp).
    const expectedContentType = this.resolveImageContentType(file.originalname);
    const expectedFormat = expectedContentType?.replace(/^image\//, '');
    if (detectedFormat && expectedFormat && detectedFormat !== expectedFormat) {
      throw new HttpException(
        `File contents (${detectedFormat}) do not match the file extension`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const safeName = sanitizeFilenameChars(path.basename(file.originalname));
    if (!isSafeFilename(safeName)) {
      throw new HttpException('Invalid image filename', HttpStatus.BAD_REQUEST);
    }
    const destPath = path.join(this.getImagesDir(), safeName);
    fs.writeFileSync(destPath, file.buffer);

    this.logger.log(
      `Uploaded overlay image "${safeName}" (${OVERLAY_IMAGE_MAX_LABEL} max)`,
    );

    return { name: safeName, path: destPath };
  }

  @Delete('images/:name')
  deleteImage(@Param('name') name: string) {
    if (!isSafeFilename(name)) {
      throw new HttpException('Invalid image name', HttpStatus.BAD_REQUEST);
    }
    const filePath = path.join(this.getImagesDir(), name);
    if (!fs.existsSync(filePath)) {
      throw new HttpException('Image not found', HttpStatus.NOT_FOUND);
    }
    fs.unlinkSync(filePath);
    return { success: true };
  }

  // ── Templates ───────────────────────────────────────────────────────────

  @Get('templates')
  async listTemplates() {
    return this.templateService.findAll();
  }

  @Get('templates/:id')
  async getTemplate(@Param('id', ParseIntPipe) id: number) {
    const template = await this.templateService.findById(id);
    if (!template) {
      throw new HttpException('Template not found', HttpStatus.NOT_FOUND);
    }
    return template;
  }

  @Post('templates')
  async createTemplate(
    @Body(new ZodValidationPipe(overlayTemplateCreateSchema))
    dto: OverlayTemplateCreate,
  ) {
    return this.templateService.create(dto);
  }

  @Put('templates/:id')
  async updateTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(overlayTemplateUpdateSchema))
    dto: OverlayTemplateUpdate,
  ) {
    const updated = await this.templateService.update(id, dto);
    if (!updated) {
      throw new HttpException(
        'Template not found or is a preset',
        HttpStatus.NOT_FOUND,
      );
    }
    return updated;
  }

  @Delete('templates/:id')
  async deleteTemplate(@Param('id', ParseIntPipe) id: number) {
    const deleted = await this.templateService.remove(id);
    if (!deleted) {
      throw new HttpException(
        'Template not found or is a preset',
        HttpStatus.NOT_FOUND,
      );
    }
    return { success: true };
  }

  @Post('templates/:id/duplicate')
  async duplicateTemplate(@Param('id', ParseIntPipe) id: number) {
    const duplicate = await this.templateService.duplicate(id);
    if (!duplicate) {
      throw new HttpException('Template not found', HttpStatus.NOT_FOUND);
    }
    return duplicate;
  }

  @Post('templates/:id/default')
  async setDefaultTemplate(@Param('id', ParseIntPipe) id: number) {
    const result = await this.templateService.setDefault(id);
    if (!result) {
      throw new HttpException('Template not found', HttpStatus.NOT_FOUND);
    }
    return result;
  }

  @Post('templates/:id/export')
  async exportTemplate(@Param('id', ParseIntPipe) id: number) {
    const template = await this.templateService.findById(id);
    if (!template) {
      throw new HttpException('Template not found', HttpStatus.NOT_FOUND);
    }
    return this.templateService.exportTemplate(template);
  }

  @Post('templates/import')
  async importTemplate(
    @Body(new ZodValidationPipe(overlayTemplateExportSchema)) data: unknown,
  ) {
    return this.templateService.importTemplate(data);
  }

  @Post('templates/:id/preview')
  async previewTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Query('itemId') itemId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!itemId) {
      throw new HttpException('itemId is required', HttpStatus.BAD_REQUEST);
    }
    const template = await this.templateService.findById(id);
    if (!template) {
      throw new HttpException('Template not found', HttpStatus.NOT_FOUND);
    }
    const result = await this.processorService.generateTemplatePreview(
      itemId,
      template,
    );
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', 'no-cache');
    return new StreamableFile(result.buffer);
  }

  // ── Kometa Export ───────────────────────────────────────────────────────

  @Post('kometa/export')
  async exportKometa(
    @Body() payload: { collectionId: string; elements: OverlayElement[] },
  ) {
    if (!payload.collectionId) {
      throw new HttpException(
        'collectionId is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const collectionIdNum = parseInt(payload.collectionId, 10);
    const collection =
      await this.collectionsService.getCollection(collectionIdNum);

    if (!collection) {
      throw new HttpException('Collection not found', HttpStatus.NOT_FOUND);
    }

    const collectionTitle = collection.title || 'Unknown Collection';
    const deleteDays = collection.deleteAfterDays ?? 30;

    let mediaList: any[] = [];
    try {
      const fetchedMedia =
        await this.collectionsService.getCollectionMedia(collectionIdNum);
      if (fetchedMedia && fetchedMedia.length > 0) {
        mediaList = fetchedMedia;
      } else if (
        collection.collectionMedia &&
        collection.collectionMedia.length > 0
      ) {
        mediaList = collection.collectionMedia;
      }
    } catch (e) {
      this.logger.error('Error fetching media for collection', e);
      mediaList = collection.collectionMedia || [];
    }

    const exportDir = path.join(configDataDir, 'kometa_export');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // --- 1. UI-Werte auslesen ---
    const bg = payload.elements.find(
      (el) => el.type === 'shape' && el.kometa,
    ) as any;
    const txt = payload.elements.find(
      (el) => el.type === 'variable' && el.kometa,
    ) as any;

    const width = bg?.width ?? 380;
    const height = bg?.height ?? 80;
    const radius = bg?.cornerRadius ?? 20;
    const x = bg?.x ?? 20;
    const y = bg?.y ?? 20;
    const fontSize = txt?.fontSize ?? 40;

    const thresholdDays = bg?.kometa?.urgentDays ?? 3;
    const bgUrgent = bg?.kometa?.urgentColor ?? '#E31E24';
    const bgWarning = bg?.kometa?.warningColor ?? '#F1C40F';
    const txtUrgent = txt?.kometa?.urgentColor ?? '#FFFFFF';
    const txtWarning = txt?.kometa?.warningColor ?? '#141414';

    // --- 2. Live-Berechnung & Maintainerr Fetch ---
    const now = new Date();
    const yamlOverlays: string[] = [];

    // HIER HOLEN WIR UNS DEN OFFIZIELLEN MAINTAINERR SERVICE!
    let mediaServer;
    try {
      mediaServer = await this.mediaServerFactory.getService();
    } catch (e) {
      this.logger.warn(
        'Could not initialize MediaServerService for Title-Fetch.',
      );
    }

    for (const mediaAny of mediaList) {
      if (!mediaAny.addDate || !mediaAny.mediaServerId) continue;

      const addDate = new Date(mediaAny.addDate);
      const diffTime = Math.abs(now.getTime() - addDate.getTime());
      const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const daysLeft = Math.max(0, deleteDays - daysPassed);

      const isUrgent = daysLeft <= thresholdDays;
      const color = isUrgent ? bgUrgent : bgWarning;
      const fontColor = isUrgent ? txtUrgent : txtWarning;

      let bannerText = '';
      if (txt?.segments && Array.isArray(txt.segments)) {
        for (const seg of txt.segments) {
          if (seg.type === 'text') {
            bannerText += seg.value;
          } else if (seg.type === 'variable' && seg.field === 'daysText') {
            if (daysLeft === 0 && txt.textToday) {
              bannerText += txt.textToday;
            } else if (daysLeft === 1 && txt.textDay) {
              bannerText += txt.textDay.replace('{0}', '1');
            } else if (txt.textDays) {
              bannerText += txt.textDays.replace('{0}', daysLeft.toString());
            } else {
              bannerText += `${daysLeft} days`;
            }
          }
        }
      } else {
        bannerText = `Noch ${daysLeft} ${daysLeft === 1 ? 'Tag' : 'Tage'}`;
      }

      // --- TITEL-ABFRAGE ÜBER DIE OFFIZIELLE MAINTAINERR API ---
      let finalTitle = `Item_${mediaAny.mediaServerId}`;
      if (mediaServer) {
        try {
          // Maintainerr holt uns den Film direkt mit allen Settings und Caches
          const meta = await mediaServer.getMetadata(mediaAny.mediaServerId);
          if (meta && meta.title) {
            finalTitle = meta.title;
          }
        } catch (e) {
          this.logger.debug(
            `Metadata fetch failed for ${mediaAny.mediaServerId}: ${e}`,
          );
        }
      }

      const mediaTitle = String(finalTitle).replace(/"/g, '\\"');
      // ---------------------------------------------------------

      const overlayBlock = `  "${mediaTitle}":
    template:
      banner_text: "${bannerText.trim()}"
      color: '${color}'
      font_color: '${fontColor}'
      item_title: "${mediaTitle}"
      name: days_left_banner`;

      yamlOverlays.push(overlayBlock);
    }

    const overlaysSection =
      yamlOverlays.length > 0
        ? yamlOverlays.join('\n\n')
        : '  # No active media found in this collection.';

    // --- 3. Finales YAML ---
    const yamlContent =
      `
overlays:
${overlaysSection}

templates:
  days_left_banner:
    overlay:
      back_color: <<color>>
      back_height: ${height}
      back_radius: ${radius}
      back_width: ${width}
      font_color: <<font_color>>
      font_size: ${fontSize}
      horizontal_align: left
      horizontal_offset: ${x}
      name: text(<<banner_text>>)
      vertical_align: top
      vertical_offset: ${y}
    plex_search:
      title: <<item_title>>
`.trim() + '\n';

    const safeTitle = sanitizeFilenameChars(collectionTitle);
    const fileName = `maintainerr_${safeTitle}.yml`;
    const filePath = path.join(exportDir, fileName);

    fs.writeFileSync(filePath, yamlContent, 'utf8');

    this.logger.log(
      `Kometa YAML exported successfully for collection "${collectionTitle}" to ${filePath}`,
    );

    return { success: true, path: filePath, fileName };
  }
}
