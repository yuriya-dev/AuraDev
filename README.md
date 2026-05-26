# DevAura

> DevAura — AI wellness companion untuk developer: mengawasi fokus, solat, makan, dan kesejahteraan saat coding.

## Ringkasan
DevAura menggabungkan tiga bagian utama:
- Backend Python/Flask yang menyediakan API dan integrasi AI (Vertex AI / mock fallbacks).
- Chrome extension kecil untuk notifikasi ringan.
- VS Code extension yang melaporkan sesi, menampilkan status, dan memanggil backend.

## Fitur Utama
- Pelacakan sesi coding (keystrokes, saves, state).
- Peringatan solat & pengingat makan.
- Parsing project brief ke milestone (menggunakan Vertex AI bila tersedia).
- Mode fallback penuh tanpa kredensial cloud (in-memory mocks).

## Struktur Repo (paling penting)
- Backend: [backend/app.py](backend/app.py)
- Backend requirements: [backend/requirements.txt](backend/requirements.txt)
- Backend Dockerfile: [backend/Dockerfile](backend/Dockerfile)
- Chrome extension: [chrome-extension/manifest.json](chrome-extension/manifest.json) dan [chrome-extension/popup.html](chrome-extension/popup.html)
- VS Code extension entry: [src/extension.ts](src/extension.ts)
- VS Code extension manifest & scripts: [package.json](package.json)

## Prasyarat
- Python 3.9+ dan pip
- Node.js 16+ dan npm
- Google Cloud credentials (opsional, untuk Firestore / Vertex AI)
- (Opsional) Docker

## Menghubungkan ke Google Cloud & Vertex AI
Jika Anda ingin menggunakan Firestore dan Vertex AI (GenAI) alih-alih mock lokal, ikuti langkah singkat ini.

1) Install dan konfigurasikan Google Cloud SDK (jika belum):

```bash
# macOS (Homebrew)
brew install --cask google-cloud-sdk
gcloud init
```

2) Aktifkan API yang diperlukan (ganti `PROJECT_ID`):

```bash
gcloud config set project PROJECT_ID
gcloud services enable aiplatform.googleapis.com
gcloud services enable firestore.googleapis.com
```

3) Buat service account untuk backend dan berikan role minimal:

```bash
gcloud iam service-accounts create devaura-sa --display-name "DevAura Service Account"
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:devaura-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:devaura-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

4) Buat dan download key JSON, lalu simpan di mesin lokal:

```bash
gcloud iam service-accounts keys create ~/devaura-key.json \
  --iam-account=devaura-sa@PROJECT_ID.iam.gserviceaccount.com
```

5) Set environment variable sehingga backend bisa mengautentikasi:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/devaura-key.json"
# atau simpan di backend/.env dan gunakan python-dotenv (sudah ada di requirements)
```

6) (Alternatif) Jika menggunakan API key untuk GenAI SDK, set `API_KEY`:

```bash
export API_KEY="ya29.your_api_key_here"
```

7) Verifikasi: jalankan backend dan periksa log startup — `app.py` akan mencetak apakah Vertex AI dan Firestore berhasil diinisialisasi.

Catatan keamanan: jangan commit file key JSON ke Git. Tambahkan path key ke `.gitignore` jika perlu.


## Setup & Menjalankan

1) Backend (lokal)

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
# (opsional) buat file .env di backend/ untuk variabel seperti GOOGLE_APPLICATION_CREDENTIALS atau API_KEY
python backend/app.py
```

Backend berjalan pada port `8080` secara default (lihat [backend/app.py](backend/app.py)).

2) Backend (Docker)

```bash
docker build -t devaura-backend -f backend/Dockerfile .
docker run -p 8080:8080 devaura-backend
```

3) Chrome Extension (development)

- Buka Chrome → Extensions → Load unpacked → pilih folder `chrome-extension/`.
- Gunakan popup untuk melihat notifikasi dan quick actions.

Cara menggunakan Chrome Extension
--------------------------------

- Aktifkan mode developer di Chrome:
  1. Buka `chrome://extensions/`.
 2. Aktifkan toggle **Developer mode** di kanan atas.
- Muat ekstensi saat development:
  1. Klik **Load unpacked** dan pilih folder `chrome-extension/` di repo ini.
 2. Ekstensi akan muncul di bar ekstensi (ikon di kanan atas browser).
- Menguji dan menggunakan:
  - Klik ikon ekstensi untuk membuka `popup.html` dan gunakan tombol/aksi yang tersedia.
  - Pastikan backend berjalan di `http://localhost:8080` (atau update URL jika Anda menjalankan di alamat lain). Ekstensi akan berkomunikasi dengan backend untuk mengirim event atau meminta notifikasi.
  - Jika fitur notifikasi diperlukan, beri izin notifikasi pada Chrome ketika diminta.
- Debugging:
  - Di halaman `chrome://extensions/` klik **background page (Inspect views)** pada ekstensi untuk membuka DevTools background script (`background.js`).
  - Buka konsol popup: klik kanan popup → Inspect untuk melihat logs dan network calls.
- Packaging (opsional):
  - Setelah siap rilis, gunakan **Pack extension** pada `chrome://extensions/` untuk membuat `.crx` atau upload folder ke Chrome Web Store.


4) VS Code Extension (development)

```bash
npm install
npm run compile
# lalu jalankan 'Run Extension' di VS Code (Launch Extension) atau gunakan 'Run Extension' dari debugger
```

Konfigurasi extension tersedia di `package.json` (default backend URL: `http://localhost:8080`). Lihat juga [src/extension.ts](src/extension.ts) untuk alur integrasi.

## Environment Variables
- `GOOGLE_APPLICATION_CREDENTIALS` — path ke service account JSON (opsional)
- `API_KEY` — API key alternatif untuk Vertex (opsional)

Simpan variabel tersebut di file `.env` di folder `backend/` jika ingin menjalankan integrasi cloud.

## Pengembangan & Catatan
- Repo didesain agar tetap berfungsi tanpa kredensial cloud — kode akan fallback ke `mock_vertex` dan DB in-memory.
- Endpoint utama:
  - `GET /` — health/status
  - `POST /event` — kirim session/event dari extension
  - `GET /check` — cek prayer times & nudge
  - `POST /parse-brief` — parsing milestone

## Kontribusi
- Silakan buka issue atau PR. Untuk perubahan cepat: buat branch, kerjakan, lalu ajukan PR.

## Lisensi
MIT (default) — tambahkan file LICENSE jika perlu.

---
File ini dibuat otomatis. Kalau mau, saya bisa juga membuat `README` versi bahasa Inggris atau menambahkan langkah commit & CI.
