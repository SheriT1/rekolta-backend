import express from 'express';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow the React frontend to send authentication cookies
 app.enableCors({
  origin: [
    'http://localhost:5173',
    'http://192.168.18.17:5173',
  ],
  credentials: true,
});

  // Read cookies from incoming requests
  app.use(cookieParser());

  // Serve uploaded product images
  app.use(
    '/uploads/products',
    express.static(join(process.cwd(), 'uploads', 'products')),
  );

  // Validate incoming request data
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}

await bootstrap();
