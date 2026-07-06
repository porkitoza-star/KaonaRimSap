import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Stores files on local/Render persistent disk. Swappable for a
 * Cloudflare R2-backed implementation later without touching callers:
 * only the stored key format (currently a bare filename) must stay stable.
 */
@Injectable()
export class LocalStorageService {
  private readonly basePath: string;

  constructor(config: ConfigService) {
    this.basePath = config.get<string>('DOCUMENTS_STORAGE_PATH', './uploads');
  }

  async save(buffer: Buffer, originalName: string): Promise<string> {
    await fs.mkdir(this.basePath, { recursive: true });
    const ext = path.extname(originalName) || '';
    const filename = `${randomUUID()}${ext}`;
    await fs.writeFile(path.join(this.basePath, filename), buffer);
    return filename;
  }

  read(storedKey: string): Promise<Buffer> {
    return fs.readFile(path.join(this.basePath, storedKey));
  }
}
