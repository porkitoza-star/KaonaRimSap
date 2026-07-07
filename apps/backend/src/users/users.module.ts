import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { LocalStorageService } from '../documents/storage/local-storage.service';

@Module({
  providers: [UsersService, LocalStorageService],
  controllers: [UsersController],
})
export class UsersModule {}
