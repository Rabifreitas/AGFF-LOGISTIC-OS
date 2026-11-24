import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { del as blobDel, get as blobGet, put as blobPut } from "@vercel/blob";

let client: S3Client | null = null;

export function getStorage(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? "us-east-1",
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? "",
        secretAccessKey: process.env.S3_SECRET_KEY ?? "",
      },
    });
  }
  return client;
}

export const bucket = () => process.env.S3_BUCKET ?? "agff-documents";

/** Chaves sempre prefixadas pela organização: isolamento multi-tenant no armazenamento. */
export function tenantObjectKey(organizationId: string, ...parts: string[]): string {
  if (!organizationId) throw new Error("organizationId required");
  const safe = parts.map((p) => p.replace(/[^a-zA-Z0-9._-]/g, "_"));
  return ["org", organizationId, ...safe].join("/");
}

/** Em produção (Vercel) os ficheiros vão para um Vercel Blob privado; em dev/CI, para MinIO/S3. */
export const usesBlobStorage = () => !!process.env.BLOB_READ_WRITE_TOKEN && process.env.STORAGE_DRIVER !== "s3";

/**
 * Prefixo onde o browser grava uploads directos (só com Blob: as funções Vercel aceitam pedidos até 4,5 MB).
 * O servidor valida o ficheiro e copia-o para a chave definitiva.
 */
export function directUploadPrefix(organizationId: string): string | null {
  return usesBlobStorage() ? tenantObjectKey(organizationId, "uploads") : null;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  if (usesBlobStorage()) {
    await blobPut(key, body, { access: "private", contentType, addRandomSuffix: false });
    return;
  }
  const put = () =>
    getStorage().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
  try {
    await put();
  } catch (e) {
    if ((e as { name?: string }).name !== "NoSuchBucket") throw e;
    await getStorage().send(new CreateBucketCommand({ Bucket: bucket() }));
    await put();
  }
}

export async function getObjectStream(key: string): Promise<ReadableStream> {
  if (usesBlobStorage()) {
    const res = await blobGet(key, { access: "private" });
    if (!res?.stream) throw new Error(`empty object: ${key}`);
    return res.stream;
  }
  const res = await getStorage().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!res.Body) throw new Error(`empty object: ${key}`);
  return res.Body.transformToWebStream();
}

export async function getObjectBytes(key: string, maxBytes: number): Promise<Buffer> {
  const reader = (await getObjectStream(key)).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("object too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function deleteObject(key: string) {
  if (usesBlobStorage()) return blobDel(key);
  await getStorage().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

export async function storageHealthy(): Promise<boolean> {
  if (usesBlobStorage()) return true;
  try {
    await getStorage().send(new HeadBucketCommand({ Bucket: bucket() }));
    return true;
  } catch {
    return false;
  }
}
