import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function uploadImageToS3(file: File, folder = 'events'): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const fileExtension = file.name.split('.').pop() || 'jpg';
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExtension}`;

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME || 'ssi-studio-events',
    Key: fileName,
    Body: buffer,
    ContentType: file.type,
  });

  await s3Client.send(command);

  return `https://${process.env.AWS_S3_BUCKET_NAME || 'ssi-studio-events'}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${fileName}`;
}

export async function downloadImageFromS3(imageUrl: string) {
  const parsedUrl = new URL(imageUrl);
  const key = decodeURIComponent(
    parsedUrl.pathname.replace(/^\/+/, ''),
  );
  const result = await s3Client.send(
    new GetObjectCommand({
      Bucket:
        process.env.AWS_S3_BUCKET_NAME ||
        'ssi-studio-events',
      Key: key,
    }),
  );

  if (!result.Body) {
    throw new Error('S3 image is empty.');
  }

  return {
    body: Buffer.from(
      await result.Body.transformToByteArray(),
    ),
    contentType: result.ContentType,
  };
}