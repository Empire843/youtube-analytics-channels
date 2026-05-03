# YouTube Channel Analytics Tool

Dashboard phan tich kenh YouTube gom 3 lop du lieu:

- `Public analysis`: danh cho moi kenh public chi voi link kenh
- `Estimated metrics`: RPM, monthly revenue, growth score duoc uoc tinh tu public signals
- `Owner verified analytics`: YouTube Analytics API cho chu kenh hoac manager

## Tinh nang da co

- So luot xem trung binh moi video
- Total views
- Last updated tu video public moi nhat
- Phat hien `Has Short`
- Bieu do `Views` tu recent uploads
- Bieu do `Views & Subscribers Graph` theo ngay khi co quyen owner
- `Estimated RPM range`
- `Estimated monthly revenue`
- `Geographic analytics`
- `Age / gender analytics`
- `Top recent videos`
- `Posting cadence`
- `Recent median views`
- `Engagement rate`
- `Growth score`
- `Content profile`

## Link-only mode

Tool nay da duoc chinh de hoat dong theo kieu:

1. Dan link kenh YouTube
2. Tool tu resolve handle/channel ID
3. Tool tu dong phan tich public metrics
4. Tool bo sung estimated RPM va revenue
5. Neu co them owner OAuth token thi nang cap sang verified analytics

Neu server da duoc cau hinh bien moi truong sau, nguoi dung cuoi khong can nhap API key:

```bash
YOUTUBE_API_KEY=AIza...
```

Hoac don gian tao file `.env.local` trong root project:

```bash
YOUTUBE_API_KEY=your_youtube_data_api_key
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash
```

## Gioi han quan trong

- `Estimated RPM` va `estimated revenue` la so lieu mo phong, khong phai doanh thu YouTube xac thuc.
- `Geographic`, `age/gender`, subscriber trend chi tiet va RPM xac thuc can owner-authorized YouTube Analytics access.
- Tool ben thu ba co the hien thi nhung chi so nay cho kenh bat ky, nhung thuong la uoc tinh hoac mo hinh du doan.

## Cach chay

```bash
node server.js
```

hoac:

```bash
npm start
```

Mo:

```text
http://localhost:3000
```

Sau khi mo web:

1. Dan link kenh YouTube
2. Bam `Analyze Channel`
3. Dashboard se tu hien public metrics
4. Neu `GEMINI_API_KEY` da co, phan `Gemini Insights` se tu sinh nhan dinh

## API local

### `GET /api/public`

Query params:

- `channel`: handle, URL, hoac channel ID
- `apiKey`: tuy chon, co the bo qua neu server da co `YOUTUBE_API_KEY`

### `POST /api/owner`

Body JSON:

```json
{
  "channelId": "UCxxxxxxxx",
  "accessToken": "ya29....",
  "startDate": "2026-01-01",
  "endDate": "2026-05-01"
}
```

## Mo rong tiep theo

- Export CSV / JSON
- Compare nhieu channel cung luc
- Snapshot lich su local de ve growth chart dai han
- Estimated niche classifier de tinh RPM range sat hon
- Watchlist nhieu kenh va auto refresh
