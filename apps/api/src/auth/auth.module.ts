import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 30,
      },
    ]),
  ],
})
export class AuthModule {}
