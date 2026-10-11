import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve, dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

export function createMediaService(store, config) {
  const uploadDir = config?.uploadDir || "uploads";
  const uploadRoot = isAbsolute(uploadDir)
    ? uploadDir
    : (existsSync(resolve(projectRoot, uploadDir)) ? resolve(projectRoot, uploadDir) : resolve(process.cwd(), uploadDir));

  return {
    async upload(payload, actor = null) {
      const contentType = String(payload.contentType || "").toLowerCase();
      const fileName = sanitizeFileName(payload.fileName || "upload");
      const dataBase64 = String(payload.dataBase64 || "").replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(dataBase64, "base64");

      if (!ALLOWED_TYPES.has(contentType)) {
        const error = new Error("Only jpeg, png, and webp images are allowed.");
        error.status = 400;
        throw error;
      }
      if (!buffer.length || buffer.length > config.maxUploadBytes) {
        const error = new Error(`Image must be between 1 byte and ${config.maxUploadBytes} bytes.`);
        error.status = 400;
        throw error;
      }
      if (!matchesMagicBytes(buffer, contentType)) {
        const error = new Error("File content does not match the specified image format.");
        error.status = 400;
        throw error;
      }

      await mkdir(uploadRoot, { recursive: true });
      const id = randomUUID();
      const extension = extensionFor(contentType, fileName);
      const storedFileName = `${id}${extension}`;
      const filePath = join(uploadRoot, storedFileName);
      await writeFile(filePath, buffer);

      const asset = await store.createMediaAsset({
        id,
        originalFileName: fileName,
        storedFileName,
        contentType,
        sizeBytes: buffer.length,
        incidentId: payload.incidentId || null,
        uploadedByUserId: actor?.sub || null,
        url: `/api/media/${id}`,
        createdAt: new Date().toISOString()
      });

      return { asset };
    },
    async read(id) {
      const asset = await store.getMediaAssetById(id);
      if (!asset) return null;
      try {
        const bytes = await readFile(join(uploadRoot, asset.storedFileName));
        return { asset, bytes };
      } catch (err) {
        if (err.code === "ENOENT") return null;
        throw err;
      }
    }
  };
}

function sanitizeFileName(fileName) {
  return basename(String(fileName)).replace(/[^\w.-]/g, "_").slice(0, 120) || "upload";
}

function extensionFor(contentType, fileName) {
  const existing = extname(fileName).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp"].includes(existing)) return existing;
  if (contentType === "image/png") return ".png";
  if (contentType === "image/webp") return ".webp";
  return ".jpg";
}

function matchesMagicBytes(buffer, contentType) {
  if (!buffer || buffer.length < 4) return false;
  if (contentType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (contentType === "image/png") {
    if (buffer.length < 8) return false;
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }
  if (contentType === "image/webp") {
    if (buffer.length < 12) return false;
    return (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    );
  }
  return false;
}
