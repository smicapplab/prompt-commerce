import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { KeysService } from './keys.service';
import { KeysController } from './keys.controller';

@Module({
  imports: [DbModule],
  providers: [KeysService],
  controllers: [KeysController],
})
export class KeysModule {}
