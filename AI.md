# AI & LLM Developer Context Guide: Agri Prima WhatsApp Bot

Berkas ini dirancang sebagai panduan instan bagi AI Coding Assistant mana pun (seperti Gemini, Cursor, Claude, dll.) untuk memahami arsitektur, basis kode, basis data, dan aturan bisnis proyek ini secara utuh dalam hitungan detik.

---

## 1. Ringkasan & Aturan Bisnis Proyek
Proyek ini adalah **Sistem Otomasi Penerimaan Dokumen WhatsApp** untuk **Agri Prima Indotama**.
* **Fungsi Utama**: Menerima kiriman media gambar dokumen (seperti Surat Jalan, Retur, Tanda Terima, Resi, dll.) melalui WhatsApp dari kontak/grup whitelisted.
* **Klasifikasi Otomatis**: Mengekstrak nama Klien, Kategori, dan Nomor PO dari obrolan pengirim melalui **Regex Match Parser** (menggunakan Alias kamus klien/kategori) atau fallback **Tesseract OCR**.
* **Penyimpanan Berstruktur**: Berkas gambar dikompresi (opsional ke WebP) dan disimpan di struktur direktori berjenjang, lalu direkam ke database PostgreSQL.
* **Dashboard Monitoring**: Web console modern Next.js untuk memantau dokumen masuk, mengelola whitelisted target, melacak histori obrolan, dan menyesuaikan alias kamus kata kunci.

---

## 2. Arsitektur Teknologi & Dependensi
Proyek ini terbagi menjadi dua sub-sistem utama:

### A. Bot Backend (Root Directory)
* **Runtime**: Node.js / Bun
* **WhatsApp API**: `whatsapp-web.js` (Puppeteer Headless Client)
* **Database Client**: Prisma ORM dengan PostgreSQL
* **Pengolahan Gambar**: `sharp` (WebP compression) & `tesseract.js` (OCR engine)
* **Pesan Tertunda**: Mekanisme buffering fixed-window selama 3-5 menit (saat ini dikonfigurasi 3 menit) yang digabungkan dengan algoritma *Caption-Proximity Slicing* untuk mengelompokkan beberapa gambar dan teks chat secara cerdas dan kronologis.

### B. Dashboard Frontend (`/dashboard`)
* **Framework**: Next.js 16 (React 19, Turbopack)
* **CSS & Styling**: Tailwind CSS v4
* **Desain UI**: Off-white/slate, responsive compact layout dengan Spa Client routing.

---

## 3. Struktur Folder Utama & Berkas Kunci

```text
whatsapp_bot/
├── AI.md                     # Berkas panduan ini (AI Context Guide)
├── package.json              # Backend dependencies (whatsapp-web.js, prisma, sharp, tesseract)
├── index.js                  # Entry point backend bot
├── config.json               # Konfigurasi fallback jika DB mati
├── history.json              # Log cadangan terlewat jika DB mati
├── prisma/
│   └── schema.prisma         # Skema database PostgreSQL
├── downloads/                # Folder penyimpanan berkas unduhan sementara (temporary)
├── classified/               # Folder penyimpanan utama hasil klasifikasi dokumen
│   └── Unclassified/         # Subfolder berkas yang gagal diklasifikasi
├── src/                      # Core Logic Bot Backend
│   ├── whatsapp.js           # Klien WA, event handler pesan, & Catch-up Sync terlewat
│   ├── fileManager.js        # Klasifikasi folder, kompresi gambar, & DB Document insertion
│   ├── parser.js             # Parser Regex pengurai Caption & OCR text
│   ├── db.js                 # Prisma client instance
│   └── config.js             # Sinkronisasi parameter config dari DB (polling per 10s)
└── dashboard/                # Aplikasi Next.js Dashboard
    ├── src/app/
    │   ├── globals.css       # Skema Design Tokens (CSS Variables) & Tema Tailwind v4
    │   ├── layout.tsx        # Shell induk & blocking script pencegah FOUC blink
    │   ├── page.tsx          # Overview Page (real-time stats & recent logs)
    │   ├── documents/        # Halaman Document Center & nested Explorer
    │   ├── history/          # Halaman Activity History log
    │   └── settings/         # Halaman Settings whitelist, kategori, dan alias keyword
    └── package.json          # Dependencies Next.js dashboard
```

---

## 4. Skema Database (Prisma Schema)

Database PostgreSQL dikelola oleh Prisma dengan skema model berikut:

* **Config**: Mengontrol status fitur bot (`autoReply`, `useOcr`, `mediaFormat`).
* **TargetUser** & **TargetGroup**: Daftar whitelisted WhatsApp ID (`id` berupa `number@c.us` atau `@g.us`) yang diproses pesan medianya oleh bot.
* **ValidCategory** & **ClientKeyword**: Tabel kamus istilah kategori dan klien dengan array `aliases` untuk pemetaan klasifikasi dinamis.
* **Document**: Rekaman berkas terklasifikasi sukses:
  * `fileName`: Berkas unik deterministik (`YYYYMMDD_HHMMSS_cleanSender_...`).
  * `filePath`: Lokasi absolut berkas fisik di server `/classified/...`.
  * `category`, `client`, `poNumber`, `sender`: Metadata dokumen hasil ekstraksi.
  * `timestamp`: Waktu perekaman ke database.
* **LogHistory**: Log kejadian sistem untuk konsol monitoring dashboard (`status` berupa SUCCESS, WARNING, ERROR, INFO).

---

## 5. Alur Logika Penting (Key Workflows)

### A. Alur Pemrosesan Pesan Masuk (Live Listener)
1. Event `message_create` dipicu di `src/whatsapp.js`.
2. Verifikasi pengirim: Apakah ID pengirim (`from` atau `author`) terdaftar di tabel whitelisted `TargetUser` atau `TargetGroup`? Jika tidak, abaikan.
3. Apakah pesan memiliki media (`msg.hasMedia`)? Jika ya, unduh media secara asinkron.
4. Masukkan berkas media terunduh dan teks chat ke **antrean buffer (`imageBuffer[groupId]`)** kronologis berdasarkan kecocokan ID pengirim & obrolan. Timer antrean bernilai tetap selama **3 menit** (*fixed window*), dipicu saat pesan pertama dari pengirim tersebut masuk dan tidak diperpanjang oleh pesan berikutnya.
5. Setelah timer 3 menit habis, `processSlicingGroup` dipicu untuk membagi pesan di antrean ke dalam sub-grup menggunakan **Algoritma Proksimitas Caption (*Caption-Proximity Slicing*)**:
   * **Skenario A (Caption Terpisah)**: Gambar-gambar tanpa caption yang diikuti oleh pesan teks chat (sebagai caption eksplisit) dari pengirim yang sama akan disatukan menjadi 1 sub-grup ber-caption tersebut.
   * **Skenario B (Inline Caption)**: Gambar yang dikirim dengan caption bawaan (*caption inline*) akan langsung membentuk sub-grup tersendiri.
   * **Skenario C (Pesan Tanpa Keterangan)**: Gambar tanpa keterangan di akhir jendela waktu akan secara cerdas digabungkan ke sub-grup ber-caption sebelumnya dari pengirim tersebut. Jika tidak ada sub-grup ber-caption sebelumnya, gambar tersebut akan dikelompokkan ke sub-grup non-caption (*Unclassified*).
6. Untuk setiap sub-grup hasil slicing, proses `processImageGroup` dijalankan secara berurutan (*synchronous sequential queue*) dengan menggunakan *timestamp kirim asli WhatsApp* (`msg.timestamp`) untuk menjamin nama berkas konsisten dan akurat:
   * Jalankan pengurai `smartExtract()` pada caption obrolan menggunakan Regex dari kamus `ClientKeyword` & `ValidCategory`.
   * Jika tidak ada kecocokan dan OCR aktif (`use_ocr: true`), jalankan `Tesseract.js` pada gambar, lalu jalankan `smartExtract()` pada hasil OCR.
   * **Sukses Klasifikasi**: Simpan gambar ke `classified/<Client>/<PO_Number>/<Category>/<Date_ItemsDesc>/...`, buat rekaman di tabel `Document`, dan kirim WhatsApp balasan sukses (kecuali status catch-up aktif).
   * **Gagal Klasifikasi**: Simpan ke `classified/Unclassified/<Sender>/<Date>/<Caption>/...` (di mana `<Sender>` diresolusi secara hirarkis menggunakan nama kontak WhatsApp asli, pushname profil, profil bisnis `verifiedName`/`shortName`, atau whitelist DB PostgreSQL agar tidak asal menggunakan nomor telepon mentah), rekam sebagai log WARNING di `LogHistory`, dan beri notifikasi peringatan ke WhatsApp pengirim (kecuali status catch-up aktif).

### B. Fitur Catch-Up Obrolan Masa Lalu (Missed Media Sync)
Berjalan otomatis secara asinkron begitu WhatsApp backend masuk status `ready`:
1. Dapatkan daftar target whitelisted aktif dari database.
2. Untuk setiap obrolan target, panggil `chat.fetchMessages({ limit: 50 })`.
3. Saring pesan yang:
   * Memiliki media (`hasMedia === true`).
   * Terkirim dalam rentang waktu **3 hari terakhir** (`timestamp` obrolan).
4. Lakukan **Pengecekan Duplikasi**:
   * Format nama file secara deterministik menggunakan *timestamp kirim asli WhatsApp* (`getFormattedDateAndTime(msg.timestamp)`).
   * Cari berkas dengan pola nama deterministik tersebut (`*dateStr_timeStr_cleanSender*`) di tabel `Document` (classified) dan folder disk lokal (unclassified).
   * Jika sudah ada, lewati (*skip*). Jika belum, unduh berkas media tersebut.
5. Jalankan pemrosesan dengan parameter `isCatchUp: true`. Ini akan mengklasifikasikan berkas secara normal, namun **menonaktifkan auto-reply WhatsApp** agar tidak membanjiri pengirim dengan notifikasi obrolan lama.

---

## 6. Desain Token & Aturan Visual Dashboard

Dashboard visual menggunakan standardisasi tipografi CSS variables yang dipetakan langsung ke Tailwind CSS v4 `@theme` pada `dashboard/src/app/globals.css`:

### Skala Tipografi
* **`text-xs`** (12px): Metadata, caption bawah, badge kategori kecil, detail histori waktu.
* **`text-sm`** (14px): **Ukuran Standar Utama**. Digunakan untuk data body tabel (Histori & Document list), isi input pencarian, tombol pagination, dan action control links.
* **`text-base`** (16px): Judul utama folder explorer, nama berkas di Explorer, label masukan form besar, switch label.
* **`text-lg`** (18px): Card headers, titles, sub-bagian dashboard.
* **`text-2xl`** (28px): Judul halaman (Dashboard, Document Center, Settings).
* **`text-3xl`** (36px): Overview data statistika angka utama.

### Kepadatan Grid & Sel Tabel (`cell-token-dense`)
Paddings sel tabel dikontrol oleh variabel spacing `--table-py: 10px` dan `--table-px: 16px` untuk memberikan impresi data-dense (padat data) tetapi tetap seimbang dan lapang secara estetika (anti-overlap).

### Penanganan Hydration & Theme Blinking
Untuk mencegah kedipan putih sesaat (*FOUC theme blink*) saat memuat halaman dengan status tema gelap, terdapat inline blocking script di `<head>` berkas `layout.tsx` Next.js yang membaca secara langsung nilai `theme` dari `localStorage` sebelum browser menggambar piksel visual pertama ke layar:
```tsx
<head>
  <script
    dangerouslySetInnerHTML={{
      __html: `
        try {
          const theme = localStorage.getItem('theme') || 'light';
          if (theme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        } catch (_) {}
      `,
    }}
  />
</head>
```
Selain itu, pastikan semua elemen `<button>` memiliki tipe eksplisit `type="button"` untuk menghindari trigger default reload/submit halaman di Next.js.
