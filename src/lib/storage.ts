import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

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

export async function putObject(key: string, body: Buffer, contentType: string) {
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
  const res = await getStorage().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!res.Body) throw new Error(`empty object: ${key}`);
  return res.Body.transformToWebStream();
}

export async function deleteObject(key: string) {
  await getStorage().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

export async function storageHealthy(): Promise<boolean> {
  try {
    await getStorage().send(new HeadBucketCommand({ Bucket: bucket() }));
    return true;
  } catch {
    return false;
  }
}
