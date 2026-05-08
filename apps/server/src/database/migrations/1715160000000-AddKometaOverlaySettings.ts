import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKometaOverlaySettings1715160000000 implements MigrationInterface {
  name = 'AddKometaOverlaySettings1715160000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Fuegt die Spalten zur Tabelle hinzu, falls sie nicht existieren
    await queryRunner.query(
      `ALTER TABLE "overlay_settings" ADD "kometaEnabled" boolean NOT NULL DEFAULT (0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "overlay_settings" ADD "kometaUrgentDays" integer NOT NULL DEFAULT (3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "overlay_settings" ADD "kometaUrgentColor" varchar NOT NULL DEFAULT ('#E31E24')`,
    );
    await queryRunner.query(
      `ALTER TABLE "overlay_settings" ADD "kometaWarningDays" integer NOT NULL DEFAULT (10)`,
    );
    await queryRunner.query(
      `ALTER TABLE "overlay_settings" ADD "kometaWarningColor" varchar NOT NULL DEFAULT ('#F1C40F')`,
    );
    await queryRunner.query(
      `ALTER TABLE "overlay_settings" ADD "kometaTextColor" varchar NOT NULL DEFAULT ('#FFFFFF')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Macht die Aenderungen rueckgaengig (Rollback)
    await queryRunner.query(
      `ALTER TABLE "overlay_settings" DROP COLUMN "kometaTextColor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "overlay_settings" DROP COLUMN "kometaWarningColor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "overlay_settings" DROP COLUMN "kometaWarningDays"`,
    );
    await queryRunner.query(
      `ALTER TABLE "overlay_settings" DROP COLUMN "kometaUrgentColor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "overlay_settings" DROP COLUMN "kometaUrgentDays"`,
    );
    await queryRunner.query(
      `ALTER TABLE "overlay_settings" DROP COLUMN "kometaEnabled"`,
    );
  }
}
