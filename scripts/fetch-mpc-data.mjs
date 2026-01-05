import fs from 'fs';
import path from 'path';
import { mkdir } from 'fs/promises';
import { Readable } from 'stream';
import { finished } from 'stream/promises';

// 配置：在此处填入您的 Cloudflare R2 / S3 公开下载链接
// 如果您还没有上传，可以使用示例链接，或者暂时留空，脚本会跳过
const EXTERNAL_DATA_URL = process.env.MPCORB_URL || "https://your-r2-bucket.your-domain.com/MPCORB.DAT";
const TARGET_DIR = path.join(process.cwd(), 'external', 'mpc');
const TARGET_FILE = path.join(TARGET_DIR, 'MPCORB.DAT');

async function downloadFile(url, dest) {
  if (url.includes("your-r2-bucket")) {
    console.warn("⚠️  No external URL configured. Skipping download.");
    console.warn("   Please upload 'external/mpc/MPCORB.DAT' to Cloudflare R2 and set MPCORB_URL env var.");
    return;
  }

  console.log(`Downloading ${url} to ${dest}...`);
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to download: ${res.status} ${res.statusText}`);
    }
    
    const fileStream = fs.createWriteStream(dest, { flags: 'wx' });
    await finished(Readable.fromWeb(res.body).pipe(fileStream));
    
    console.log("✅ Download complete.");
  } catch (err) {
      if (err.code === 'EEXIST') {
          console.log('✅ File already exists (race condition), skipping.');
          return;
      }
      // If error occurs, try to remove the partial file
      fs.unlink(dest, () => {});
      throw err;
  }
}

async function main() {
  if (fs.existsSync(TARGET_FILE)) {
    console.log("✅ MPCORB.DAT already exists. Skipping download.");
    return;
  }

  await mkdir(TARGET_DIR, { recursive: true });

  try {
    await downloadFile(EXTERNAL_DATA_URL, TARGET_FILE);
  } catch (error) {
    console.error("❌ Error downloading data:", error.message);
    // 在CI环境中，下载失败可能导致构建失败，视情况决定是否 process.exit(1)
  }
}

main();
