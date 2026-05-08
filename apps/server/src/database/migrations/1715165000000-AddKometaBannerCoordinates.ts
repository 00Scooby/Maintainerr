import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKometaBannerCoordinates1715165000000 implements MigrationInterface {
  name = 'AddKometaBannerCoordinates1715165000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "overlay_settings" ADD "kometaBannerX" integer NOT NULL DEFAULT (16)`,
    );
    await queryRunner.query(
      `ALTER TABLE "overlay_settings" ADD "kometaBannerY" integer NOT NULL DEFAULT (16)`,
    );
    await queryRunner.query(
      `ALTER TABLE "overlay_settings" ADD "kometaBannerW" integer NOT NULL DEFAULT (120)`,
    );
    await queryRunner.query(
      `ALTER TABLE "overlay_settings" ADD "kometaBannerH" integer NOT NULL DEFAULT (32)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "overlay_settings" DROP COLUMN "kometaBannerH"`,
    );
    await queryRunner.query(
      `ALTER TABLE "overlay_settings" DROP COLUMN "kometaBannerW"`,
    );
    await queryRunner.query(
      `ALTER TABLE "overlay_settings" DROP COLUMN "kometaBannerY"`,
    );
    await queryRunner.query(
      `ALTER TABLE "overlay_settings" DROP COLUMN "kometaBannerX"`,
    );
  }
}
