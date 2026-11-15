import { config } from './config.js';
import { connectDatabase } from './database.js';

let ready;

/**
 * Bảo đảm CSDL đã kết nối trong suốt vòng đời của một function instance.
 * Vercel không có bước khởi động server nên migration/seed (nếu bật) chỉ chạy
 * một lần cho mỗi instance, không chạy lại ở mỗi request.
 */
export function ensureDatabase() {
  if (!ready) {
    ready = bootstrap().catch((error) => {
      ready = undefined;
      throw error;
    });
  }
  return ready;
}

async function bootstrap() {
  const pool = await connectDatabase();
  if (config.autoSetup) {
    try {
      const { runSeed } = await import('./seed.js');
      await runSeed();
    } catch (error) {
      // Không chặn API khi CSDL đã được migration sẵn (ví dụ trên Vercel,
      // thư mục migrations không nằm trong bundle của function).
      console.warn(`Bỏ qua bước migration/seed tự động: ${error.message}`);
    }
  }
  return pool;
}
