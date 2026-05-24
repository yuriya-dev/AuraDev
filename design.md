# DevAura Design Specification (2026 Edition)
> System Version: v1.0.0-alpha (Hackathon Prototype)
> Design Language: Material Design 3 (Material You) for Developers

---

## 1. Design Philosophy

DevAura adalah jembatan antara produktivitas tinggi dan kesejahteraan spiritual/fisik. Pendekatan desain kami didasarkan pada tiga prinsip utama Google Design 2026:

* **Contextual Adaptability (Dynamic Visuals):** Antarmuka harus berubah secara visual berdasarkan status fokus developer (*Deep Focus*, *Frustrated*, atau *Idle*).
* **Glanceable Clarity:** Informasi penting seperti waktu solat berikutnya dan skor *wellness* harus dapat dipahami dalam waktu kurang dari 1 detik di status bar VSCode.
* **Non-Intrusive Presence:** Desain tidak boleh mendominasi ruang kerja. Notifikasi bersifat santun, menghormati mode presentasi atau *meeting* user.

---

## 2. Color Palette & Dynamic Themes

Mengikuti standar *Material You*, DevAura menggunakan palet warna berbasis tonal yang adaptif. Khusus untuk DevAura, warna aksen utama (Primary) akan bergeser secara dinamis mengikuti **Mental State Classifier** dari Gemini.

### 2.1 Base Theme (System State: Neutral/Idle)
| Element | Hex Code | Material Token | Usage |
|---|---|---|---|
| **Primary** | `#0B57D0` | `md.sys.color.primary` | Google Blue, tombol utama, status aktif |
| **Secondary** | `#1EA896` | `md.sys.color.secondary` | Teal/Islamic Green, indikator Solat & Ibadah |
| **Surface** | `#1E1E1E` | `md.sys.color.surface` | Latar belakang komponen/extension (Dark Mode) |
| **On Surface** | `#E3E3E3` | `md.sys.color.on-surface` | Teks utama, kontras tinggi |

### 2.2 Dynamic States (Mood-Aware Palette)
[ Deep Focus State ]  ──► Aksen Purple (#7C4DFF)  ──► Tenang, minim gangguan
[ Frustrated State ]  ──► Aksen Amber (#FFB300)   ──► Hangat, menurunkan stres
[ Alert / Overtime ]  ──► Aksen Coral (#EA4335)   ──► Mengingatkan untuk istirahat


---

## 3. Typography

Menggunakan font standar ekosistem Google 2026 untuk keterbacaan kode dan UI yang optimal:

* **UI Labels & Headers:** `Google Sans Text`, Sans-serif (Clean, modern, humanist)
* **Metrics & Numbers:** `Google Sans Display`, Bold (Untuk skor *wellness* dan *countdown* timer)
* **Code & Extension Logs:** `Roboto Mono`, Monospace (Sesuai dengan lingkungan VSCode asli)

---

## 4. Component UI Specifications

### 4.1 VSCode Status Bar Integration
Komponen paling krulial yang menetap di bagian bawah *workspace* developer. Desain dibuat sekecil mungkin namun informatif.

+-------------------------------------------------------------------------------+
|  ... | 🔮 DevAura: Deep Focus (2h 15m) | 🕌 Next: Dhuhr (45m) | ✨ Score: 85  |
+-------------------------------------------------------------------------------+

* **Iconography:** Menggunakan *VSCode Codicons* yang dipetakan ke Material Symbols (`loading~spin` saat menganalisis, `heart` untuk skor kesehatan).

### 4.2 Material Design Nudge Cards (FCM & Slack)
Desain kartu notifikasi yang dikirimkan oleh Cloud Run via Firebase Cloud Messaging atau Slack Webhook.

+---------------------------------------------------------------+
|  🔮 DevAura  •  Just now                                      |
+---------------------------------------------------------------+
|  "Bro, kamu baru aja defeat final boss (bug fix commit).     |
|   Sekarang giliran Maghrib dulu. Mantap! 🎮🕌"                |
|                                                               |
|  [ Sudah Solat ]          [ Tunda 5 Menit ]                   |
+---------------------------------------------------------------+

* **Corner Radius:** `16px` (Mengikuti standar Material Design 3 kartu melengkung).
* **Button Hierarchy:** Tombol `Sudah Solat` menggunakan *Filled Tonal Button*, tombol `Tunda` menggunakan *Text Button*.

### 4.3 Weekly Wellness Report (Slack DM Layout)
Desain *dashboard* mini dalam bentuk teks dan blok komponen Slack (Block Kit API) bergaya korporat Google yang bersih.

* **Header:** `✨ DevAura Weekly Balance Report Card`
* **Section 1 (Metrics):**
    * 🟢 **Solat Tracker:** 22/25 On Time (Streak 🔥)
    * 🟡 **Meal Nutrition:** Skip lunch twice (Inferred from idle state)
    * 🔴 **Sleep Pattern:** 3 nights coded past 2 AM
* **AI Insight Section:** Menggunakan *blockquote* dengan latar belakang warna kontras rendah untuk memisahkan hasil prediksi *burnout* dari Gemini.

---

## 5. User Experience (UX) Guardrails

Untuk memastikan aplikasi ini memenangkan Google Cloud Hackathon, beberapa aturan UX ketat berbasis Google AI UX Guidelines diterapkan:

1.  **Anti-Distraction Lock:** Jika status user adalah `deep-focus`, semua notifikasi visual dan audio (termasuk pengingat solat awal waktu) akan **ditahan secara visual** di status bar dan baru dilepaskan (*pop-up*) saat terdeteksi status `idle` selama 15 detik.
2.  **Contextual Azan Suppressor:** Jika mik atau *screen sharing* aktif (terdeteksi via Chrome Extension/System API), notifikasi suara ditiadakan untuk menjaga profesionalisme user saat rapat.
3.  **One-Click Confirmation:** Setiap interaksi pasca-nudge (misal: konfirmasi sudah makan atau solat) tidak boleh memakan waktu lebih dari 1 klik direktori dari VSCode.

---

## 6. Asset & Branding Requirements

* **Logo Concept:** Huruf "D" yang menyatu dengan simbol aura bercahaya (menggunakan gradasi warna khas Google: Blue ke Teal).
* **Design Tokens Deliverable:** Semua pengaturan warna wajib merujuk pada file `theme.json` di dalam folder ekosistem VSCode Extension untuk mempermudah sinkronisasi tema.