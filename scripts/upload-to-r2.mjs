import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';

// Load R2 config
dotenv.config({ path: ".env.r2" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
  console.error("❌ Missing R2 credentials. Please create .env.r2 with R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.");
  console.log("👉 Copy r2-config.example.env to .env.r2 and fill in your values.");
  process.exit(1);
}

const R2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const FILES_TO_UPLOAD = [
  "external/mpc/MPCORB.DAT",
  "external/mpc/MPCORB.DAT.gz"
];

async function uploadFile(filePath) {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️ File not found: ${filePath}`);
    return;
  }

  const fileStream = fs.createReadStream(fullPath);
  const fileSize = fs.statSync(fullPath).size;
  const fileName = path.basename(filePath);
  const key = `MPCORB/${fileName}`; // Clean path in bucket

  console.log(`🚀 Uploading ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)...`);

  try {
    await R2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: fileStream,
      ContentType: "application/octet-stream",
    }));
    
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
    console.log(`✅ Uploaded: ${publicUrl}`);
    return publicUrl;
  } catch (err) {
    console.error(`❌ Failed to upload ${fileName}:`, err);
  }
}

async function main() {
  console.log("📡 Connecting to Cloudflare R2...");
  for (const file of FILES_TO_UPLOAD) {
    await uploadFile(file);
  }
  console.log("✨ All operations complete.");
}

main();
