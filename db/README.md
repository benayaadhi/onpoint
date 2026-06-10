# Database — Supabase functions & revert guide

## `activation_codes.sql` — gerbang tier + kode aktivasi

**Apa ini:** tabel kode aktivasi + fungsi `redeem_activation_code` + tabel
`network_ads` (reel iklan WePadl untuk paket Starter). Sekali kode dipakai
untuk membuat tournament, statusnya `used` dan tidak bisa dipakai lagi
(atomic, aman dari dua orang menebus barengan).

**Pasang:** paste isi `activation_codes.sql` di SQL Editor, Run sekali.

**Sebelum dipasang:** app tetap jalan — pembuatan tournament tidak minta
validasi (fallback "ungated", tournament dibuat tanpa tier = akses penuh).
**Setelah dipasang:** buat tournament wajib kode yang valid.

**Generate kode jualan:**
```bash
npx tsx scripts/gen-codes.ts tournament 3 "Budi - WA 0812xxx"
```
Tier: `starter` (1jt) | `compact` (2jt) | `tournament` (4jt) | `championship` (6jt).

**Revert:** drop function + kedua tabel (lihat komentar di akhir file SQL);
app otomatis balik ke perilaku ungated.

---

Tournaments are stored as **one `jsonb` row per tournament** in the
`tournaments` table. These SQL files are **additive** — they don't change the
table, columns, or any data; they only add/remove a function and change *how*
the app writes.

---

## `save_tournament_merged`

**Apa ini:** fungsi RPC buat nyimpen turnamen secara aman pas **dua court di-skor
barengan**. Tanpa ini, tiap poin nyimpen SELURUH baris → save dari satu court
nimpa progress court lain (last-write-wins): skor balik, match kehilangan court,
state nyangkut.

**Cara kerja:** lock baris turnamen → merge `matches` per-id (ambil yang
`lastUpdated`-nya paling baru) → hitung ulang `court.currentMatch` dari status
match. Hasilnya: court 5 & 6 nggak saling timpa.

**Additive & reversible.** Client punya **fallback**: kalau fungsi ini nggak ada,
otomatis pakai `upsert` lama. Jadi app jalan baik sebelum maupun sesudah dipasang.

---

### 1. Pasang (install)

Buka **Supabase → SQL Editor**, paste isi `save_tournament_merged.sql`, **Run**.

### 2. Cek udah kepasang

```sql
select proname, pronargs
from pg_proc
where proname = 'save_tournament_merged';
```

Muncul **1 baris** = terpasang.

### 3. Revert / hapus (kalau ada error)

Paste isi `save_tournament_merged_revert.sql` (atau langsung):

```sql
drop function if exists save_tournament_merged(text, text, text, jsonb);
```

Begitu di-drop:
- Client **otomatis balik** ke cara lama (`upsert`) — **nggak error, nggak downtime**.
- **Nggak ada data hilang** — fungsi ini nggak pernah ngubah/migrasi data, cuma cara nulis.
- Mau pasang lagi nanti? Tinggal Run `save_tournament_merged.sql` lagi (pakai `create or replace`, aman diulang).

### 4. Revert kode client (opsional)

Drop fungsi aja **udah cukup** balikin perilaku ke semula (karena fallback).
Kalau mau balikin kode client sepenuhnya juga:

```bash
git revert b7b5cc2   # commit "Fix concurrent-court save clobbering"
# lalu deploy
```

Atau deploy build sebelumnya. Perubahan client lain (stamp `lastUpdated`, merge
saat subscribe) aman dibiarkan — nggak ganggu kalau fungsinya nggak ada.

---

## FAQ

**Bakal ngerusak data lama?** Nggak. Murni nambah fungsi; tabel & isi `data`
nggak disentuh.

**Kalau pasang fungsi tapi client belum ke-deploy?** Aman — client lama tetap
`upsert` seperti biasa. Fungsi cuma kepakai pas client baru manggil RPC.

**Kalau client baru ke-deploy tapi fungsi belum dipasang?** Aman — client coba
RPC, gagal, fallback ke `upsert`. Begitu fungsi dipasang, save berikutnya pakai
merge.

**Urutan pasang vs deploy?** Bebas. Idealnya pasang fungsi dulu biar pas client
baru live langsung aktif, tapi nggak wajib.
