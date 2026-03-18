import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';

@Module({
  imports: [DbModule],
  providers: [CatalogService],
  controllers: [CatalogController],
})
export class CatalogModule {}
