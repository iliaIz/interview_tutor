/**
 * zipGenerator.ts
 * Lightweight Zero-Dependency In-Memory ZIP Archive Generator
 * Uses native Node.js 22 zlib.deflateRawSync and zlib.crc32.
 */

import zlib from 'node:zlib';

export interface ZipEntry {
  path: string;
  content: string | Buffer;
}

/**
 * Creates an in-memory PKZIP archive buffer from an array of file entries.
 */
export function createZipArchive(entries: ZipEntry[]): Buffer {
  const localFileChunks: Buffer[] = [];
  const centralDirChunks: Buffer[] = [];
  let currentOffset = 0;

  for (const entry of entries) {
    // Normalize path to use forward slashes
    const normalizedPath = entry.path.replace(/\\/g, '/').replace(/^\/+/, '');
    const pathBuffer = Buffer.from(normalizedPath, 'utf8');

    const dataBuffer = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(entry.content, 'utf8');

    const crc = zlib.crc32(dataBuffer);
    const uncompressedSize = dataBuffer.length;

    // Compress using raw deflate
    const compressedData = zlib.deflateRawSync(dataBuffer);
    const compressedSize = compressedData.length;

    // Use Deflate (method 8)
    const compressionMethod = 8;

    // --- Local File Header (30 bytes + path length) ---
    const localHeader = Buffer.alloc(30 + pathBuffer.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4);          // version needed to extract (2.0)
    localHeader.writeUInt16LE(0x0800, 6);      // general purpose bit flag (UTF-8)
    localHeader.writeUInt16LE(compressionMethod, 8); // compression method (8 = deflate)
    localHeader.writeUInt16LE(0, 10);          // file last mod time
    localHeader.writeUInt16LE(0, 12);          // file last mod date
    localHeader.writeUInt32LE(crc, 14);        // crc-32
    localHeader.writeUInt32LE(compressedSize, 18);   // compressed size
    localHeader.writeUInt32LE(uncompressedSize, 22); // uncompressed size
    localHeader.writeUInt16LE(pathBuffer.length, 26); // file name length
    localHeader.writeUInt16LE(0, 28);          // extra field length
    pathBuffer.copy(localHeader, 30);

    localFileChunks.push(localHeader, compressedData);

    // --- Central Directory Header (46 bytes + path length) ---
    const centralHeader = Buffer.alloc(46 + pathBuffer.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(20, 4);         // version made by
    centralHeader.writeUInt16LE(20, 6);         // version needed to extract
    centralHeader.writeUInt16LE(0x0800, 8);     // general purpose bit flag (UTF-8)
    centralHeader.writeUInt16LE(compressionMethod, 10); // compression method
    centralHeader.writeUInt16LE(0, 12);         // last mod file time
    centralHeader.writeUInt16LE(0, 14);         // last mod file date
    centralHeader.writeUInt32LE(crc, 16);       // crc-32
    centralHeader.writeUInt32LE(compressedSize, 20);   // compressed size
    centralHeader.writeUInt32LE(uncompressedSize, 24); // uncompressed size
    centralHeader.writeUInt16LE(pathBuffer.length, 28); // file name length
    centralHeader.writeUInt16LE(0, 30);         // extra field length
    centralHeader.writeUInt16LE(0, 32);         // file comment length
    centralHeader.writeUInt16LE(0, 34);         // disk number start
    centralHeader.writeUInt16LE(0, 36);         // internal file attributes
    centralHeader.writeUInt32LE(0, 38);         // external file attributes
    centralHeader.writeUInt32LE(currentOffset, 42); // relative offset of local header
    pathBuffer.copy(centralHeader, 46);

    centralDirChunks.push(centralHeader);

    currentOffset += localHeader.length + compressedData.length;
  }

  const centralDirBuffer = Buffer.concat(centralDirChunks);
  const centralDirSize = centralDirBuffer.length;
  const centralDirOffset = currentOffset;

  // --- End of Central Directory Record (EOCD - 22 bytes) ---
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4);          // number of this disk
  eocd.writeUInt16LE(0, 6);          // number of the disk with start of central directory
  eocd.writeUInt16LE(entries.length, 8);  // total entries in central dir on this disk
  eocd.writeUInt16LE(entries.length, 10); // total entries in central dir
  eocd.writeUInt32LE(centralDirSize, 12); // size of central directory
  eocd.writeUInt32LE(centralDirOffset, 16); // offset of start of central directory
  eocd.writeUInt16LE(0, 20);         // zip file comment length

  return Buffer.concat([...localFileChunks, centralDirBuffer, eocd]);
}
