
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ProductsModule } from './products/products.module.js';
import { PrismaService } from './prisma/prisma.service.js';
import { AuthModule } from './auth/auth.module.js';
import { PurchaseRequestsModule } from './purchase-requests/purchase-requests.module.js';

@Module({
  imports: [
    ProductsModule,
    AuthModule,
    PurchaseRequestsModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
