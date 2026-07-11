import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET ยังไม่ได้ตั้งค่า — ต้องกำหนดค่านี้ก่อนรันระบบ (ห้ามใช้ค่า default ใน production)',
    );
  }

  const app = await NestFactory.create(AppModule);
  app.use(helmet());

  // Vercel gives every preview deployment (one per branch/PR) its own
  // subdomain distinct from the production FRONTEND_URL, e.g.
  // "kaona-rim-sap-frontend-git-<branch>-kaona-rim-sap.vercel.app" — allow
  // those alongside the configured production origin so preview links work
  // for review, not just the main deployed site.
  const frontendUrl = process.env.FRONTEND_URL;
  const vercelPreviewRe = /^https:\/\/kaona-rim-sap-frontend-[a-z0-9-]+\.vercel\.app$/i;
  app.enableCors({
    origin: !frontendUrl
      ? true
      : (origin, callback) => {
          if (!origin || origin === frontendUrl || vercelPreviewRe.test(origin)) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'), false);
          }
        },
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
