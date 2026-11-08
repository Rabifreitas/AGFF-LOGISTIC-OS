import { HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

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
  await getStorage().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
}

export async function storageHealthy(): Promise<boolean> {
  try {
    await getStorage().send(new HeadBucketCommand({ Bucket: bucket() }));
    return true;
  } catch {
    return false;
  }
}
