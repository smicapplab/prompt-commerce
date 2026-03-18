import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { KeysModule } from './keys/keys.module';
import { CatalogModule } from './catalog/catalog.module';

@Module({
  imports: [
    DbModule,
    AuthModule,
    UsersModule,
    KeysModule,
    CatalogModule,
  ],
})
export class AppModule {}
