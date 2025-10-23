// Filesystem Storage Adapter for RAG documents

import fs from 'fs/promises';
import path from 'path';
import { StorageAdapter } from './types';

export class FilesystemStorageAdapter implements StorageAdapter {
  private baseDir: string;

  constructor(baseDir: string = './rag-storage') {
    this.baseDir = baseDir;
  }

  /**
   * Store a file and return its storage path
   */
  async put(filePath: string, data: Buffer): Promise<string> {
    const fullPath = path.join(this.baseDir, filePath);
    const dir = path.dirname(fullPath);
    
    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });
    
    // Write file
    await fs.writeFile(fullPath, data);
    
    return filePath;
  }

  /**
   * Retrieve a file by its storage path
   */
  async get(filePath: string): Promise<Buffer> {
    const fullPath = path.join(this.baseDir, filePath);
    return await fs.readFile(fullPath);
  }

  /**
   * Generate a presigned URL (stub for filesystem - returns local path)
   */
  async presign(filePath: string, expiresIn: number = 3600): Promise<string> {
    // For filesystem, we just return the path
    // In production with S3, this would generate a signed URL
    return path.join(this.baseDir, filePath);
  }

  /**
   * Delete a file
   */
  async delete(filePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, filePath);
    await fs.unlink(fullPath);
  }

  /**
   * Check if a file exists
   */
  async exists(filePath: string): Promise<boolean> {
    const fullPath = path.join(this.baseDir, filePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let storageInstance: FilesystemStorageAdapter | null = null;

export function getStorageAdapter(): FilesystemStorageAdapter {
  if (!storageInstance) {
    storageInstance = new FilesystemStorageAdapter();
  }
  return storageInstance;
}
