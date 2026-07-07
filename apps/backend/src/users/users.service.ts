import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LocalStorageService } from '../documents/storage/local-storage.service';

const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatarUrl: true,
  isActive: true,
  createdAt: true,
};

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private storage: LocalStorageService,
  ) {}

  findAll() {
    return this.prisma.user.findMany({
      select: PUBLIC_USER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: PUBLIC_USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException('ไม่พบผู้ใช้นี้');
    }
    return user;
  }

  async updateProfile(id: string, name: string) {
    const updated = await this.prisma.user.update({
      where: { id },
      data: { name },
      select: PUBLIC_USER_SELECT,
    });
    await this.audit.log({
      userId: id,
      action: 'UPDATE',
      entityType: 'User',
      entityId: id,
      after: updated,
    });
    return updated;
  }

  async updateRole(id: string, role: Role, actingUserId: string) {
    const before = await this.findOne(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { role },
      select: PUBLIC_USER_SELECT,
    });
    await this.audit.log({
      userId: actingUserId,
      action: 'UPDATE_ROLE',
      entityType: 'User',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async uploadAvatar(id: string, file: Express.Multer.File) {
    const avatarUrl = await this.storage.save(file.buffer, file.originalname);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { avatarUrl },
      select: PUBLIC_USER_SELECT,
    });
    await this.audit.log({
      userId: id,
      action: 'UPDATE_AVATAR',
      entityType: 'User',
      entityId: id,
      after: updated,
    });
    return updated;
  }

  async getAvatarBuffer(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user?.avatarUrl) {
      throw new NotFoundException('ผู้ใช้นี้ยังไม่มีรูปโปรไฟล์');
    }
    const buffer = await this.storage.read(user.avatarUrl);
    const ext = user.avatarUrl.split('.').pop()?.toLowerCase();
    const contentType =
      ext === 'png'
        ? 'image/png'
        : ext === 'webp'
          ? 'image/webp'
          : ext === 'gif'
            ? 'image/gif'
            : 'image/jpeg';
    return { buffer, contentType };
  }
}
