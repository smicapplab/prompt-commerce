import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import path from 'path';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Serve the admin HTML/CSS from packages/admin/public/
  // __dirname is src/ in dev (ts-node) and dist/ in prod (tsc) —
  // both resolve to packages/admin/public via '../public'
  const publicPath = path.join(__dirname, '..', 'public');
  app.useStaticAssets(publicPath);

  // Global CORS for local development
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = parseInt(process.env.ADMIN_PORT ?? '3000', 10);
  await app.listen(port);

  console.log(`\n🛠️   Prompt Commerce Admin`);
  console.log(`   UI  : http://localhost:${port}`);
  console.log(`   API : http://localhost:${port}/api`);
  console.log('');
}

bootstrap().catch((err: unknown) => {
  console.error('Failed to start admin server:', err);
  process.exit(1);
});
