# Triển khai một deployment Vercel duy nhất

Mục tiêu: một repository, một deployment — Vercel build Frontend ở thư mục gốc và chạy Backend từ thư mục `api/`. **Không có `vercel.json`**: mọi thứ dựa trên quy ước mặc định của Vercel cho framework Vite và thư mục `api/`.

## 1. Chuẩn bị CSDL

API dùng SQL Server. Vercel chạy trên Linux nên:

- Dùng `SQL_AUTH=sql` với tài khoản SQL (driver thuần JS của `mssql`).
- SQL Server phải **truy cập được từ Internet** (VNPT/FPT mở cổng, Azure SQL, hoặc một VPS có IP công khai). Windows Authentication chỉ dùng được khi phát triển trên Windows.
- Nếu dùng Azure SQL: `SQL_SERVER=<server>.database.windows.net`, `SQL_PORT=1433`, `SQL_ENCRYPT=true`, `SQL_TRUST_SERVER_CERT=false`.

Áp dụng schema một lần từ máy có quyền truy cập CSDL:

```bash
SQL_AUTH=sql SQL_SERVER=… SQL_USER=… SQL_PASSWORD=… SQL_DATABASE=HuongSpaDB \
  npm run migrate      # hoặc npm run seed để có thêm tài khoản/cấu hình mẫu
```

## 2. Import project vào Vercel

1. **Add New → Project → Import Git Repository**.
2. **Framework Preset**: Vercel tự nhận diện **Vite** (nhờ `vite.config.js` + `package.json`).
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - **Root Directory: để trống** (thư mục gốc của repository).
3. Không thêm `vercel.json`, không cấu hình rewrite/route thủ công:
   - Frontend tĩnh được build ra `dist/` và phục vụ ở `/`.
   - Mọi tệp trong `api/` tự động trở thành Serverless Function tại `/api/...`.
   - Vite Router (React Router) hoạt động nhờ preset SPA mặc định của Vercel (mọi đường dẫn không phải tệp/`api` đều trả `index.html`).
4. Thêm biến môi trường (Production + Preview) theo bảng trong [README](../README.md), tối thiểu:

   ```
   JWT_SECRET=<chuỗi ngẫu nhiên ≥ 32 ký tự>
   SQL_AUTH=sql
   SQL_SERVER=…
   SQL_PORT=1433
   SQL_DATABASE=HuongSpaDB
   SQL_USER=…
   SQL_PASSWORD=…
   SQL_ENCRYPT=true
   SQL_TRUST_SERVER_CERT=false
   AUTO_SETUP=false
   N8N_WEBHOOK_BASE_URL=…
   N8N_PUBLIC_BASE_URL=…
   N8N_WEBHOOK_SECRET=…
   JOBS_SECRET=<chuỗi ngẫu nhiên>
   PUBLIC_BASE_URL=https://<tên-miền>
   PDF_FONT_PATH=…/fonts/NotoSans-Regular.ttf
   PDF_BOLD_FONT_PATH=…/fonts/NotoSans-Bold.ttf
   ```

5. Deploy. Kiểm tra nhanh: `https://<domain>/api/health` trả `200` với `{"code":"OK",…}`.

> **Lưu ý về số lượng function:** Vercel giới hạn 12 Serverless Functions mỗi deployment ở gói Hobby (Pro không giới hạn). Vì mỗi endpoint là một tệp trong `api/` (43 tệp), deployment này cần gói Pro. Nếu bắt buộc dùng Hobby, hãy gộp các route vào một ít function (ví dụ `api/[...path].js`) thay vì giữ mỗi endpoint một tệp.

## 3. Vì sao không cần `vercel.json`

| Nhu cầu | Cách Vercel xử lý mặc định |
|---|---|
| Build giao diện | Tự nhận diện Vite, chạy `npm run build`, phục vụ `dist/` |
| API `/api/...` | Mỗi tệp trong `api/` là một function; `[id]` là tham số động, `[...path]` bắt mọi đoạn còn lại |
| Mã dùng chung | Thư mục `api/_lib/` bắt đầu bằng `_` nên không sinh endpoint |
| CORS | Không cần: Frontend và API cùng domain, mọi lời gọi là đường dẫn tương đối `/api/...` |
| SPA fallback | Có sẵn trong framework preset Vite |

## 4. Tác vụ định kỳ thay cho timer nền

Serverless function không giữ tiến trình chạy nền, nên ba vòng lặp cũ (nhắc lịch hẹn, quét hạn sử dụng hằng ngày, gửi thông báo n8n) được gom vào `POST /api/jobs/tick`:

```bash
curl -X POST https://<domain>/api/jobs/tick -H "Authorization: Bearer $JOBS_SECRET"
```

Đặt lịch bằng n8n **Schedule Trigger** (workflow đã có sẵn trong `n8n/`) hoặc GitHub Actions:

```yaml
on:
  schedule: [{ cron: '*/5 * * * *' }]
jobs:
  tick:
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS -X POST "${{ secrets.APP_URL }}/api/jobs/tick" -H "Authorization: Bearer ${{ secrets.JOBS_SECRET }}"
```

## 5. Kiểm thử sau khi deploy

1. `/api/health` → 200.
2. Mở `/dang-nhap`, đăng nhập bằng tài khoản seed (sau khi đổi mật khẩu ở môi trường thật).
3. `/api/docs` để xem Swagger UI (đọc `public/openapi.json`).
4. Gọi `POST /api/auth/login` sai mật khẩu → 401 `AUTH_INVALID`; gọi không token tới `/api/customers` → 401.

## 6. Sự cố thường gặp

| Hiện tượng | Nguyên nhân thường gặp |
|---|---|
| Mọi request 500, log `Server is not found or not accessible` | `SQL_SERVER`/`SQL_PORT` sai hoặc SQL Server chưa mở cổng Internet cho Vercel |
| `Cần cấu hình SQL_USER và SQL_PASSWORD` | Đặt `SQL_AUTH=sql` nhưng thiếu tài khoản, hoặc còn `SQL_AUTH=windows` |
| `JWT_SECRET phải được thay…` | Chưa đặt `JWT_SECRET` ở môi trường production |
| Upload ảnh lỗi `413` | Vercel giới hạn request body ≈ 4,5 MB, thấp hơn giới hạn 8 MB của API |
| Ảnh/PDF mất sau ít phút | Filesystem của function là tạm thời: chuyển sang Vercel Blob/S3 nếu cần lưu lâu dài |
| `Bỏ qua bước migration/seed tự động` | `AUTO_SETUP=true` nhưng function không đọc được `migrations/`; đặt `AUTO_SETUP=false` và chạy `npm run migrate` |
