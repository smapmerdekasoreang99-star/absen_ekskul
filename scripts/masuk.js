import { ambilMaster, cekPembina } from '../assets/db.js?v=20260923b';
import { masukSebagai, tandaiMode, laporError, bersihkanPesan, PIN_PENGELOLA, pembimbingDari }
  from '../assets/ui.js?v=20260923b';

const el = id => document.getElementById(id);
let peran = 'pembina';

// Berapa lama daftar nama boleh "Memuat…" sebelum pembina diberi tahu bahwa
// jaringannya yang lambat — bukan aplikasinya yang rusak. Permintaannya
// sendiri tidak dibatalkan: begitu jawabannya datang, daftar tetap terisi.
const BATAS_MUAT_MS = 15000;

try { tandaiMode(); } catch (e) { console.error(e); }

el('pilihPeran').addEventListener('click', ev => {
  const b = ev.target.closest('button');
  if (!b) return;
  peran = b.dataset.peran;
  [...el('pilihPeran').children].forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  el('bagianPembina').classList.toggle('sembunyi', peran !== 'pembina');
  el('bagianPengelola').classList.toggle('sembunyi', peran !== 'pengelola');
  bersihkanPesan();
});

el('tombolMasuk').addEventListener('click', masuk);
el('cobaLagi').addEventListener('click', muatDaftar);
document.addEventListener('keydown', ev => { if (ev.key === 'Enter') masuk(); });

let percobaan = 0;
async function muatDaftar() {
  const ke = ++percobaan;
  bersihkanPesan();
  el('cobaLagi').classList.add('sembunyi');
  el('pilihNama').innerHTML = '<option value="">Memuat…</option>';

  const pengingat = setTimeout(() => {
    if (ke !== percobaan) return;
    el('pilihNama').innerHTML = '<option value="">Jaringan lambat…</option>';
    laporError('Daftar nama belum terbaca. Jaringan sedang lambat — tunggu sebentar, ' +
               'atau ketuk Coba lagi.');
    el('cobaLagi').classList.remove('sembunyi');
  }, BATAS_MUAT_MS);

  try {
    const { pembina, ekskul } = await ambilMaster();
    if (ke !== percobaan) return;          // sudah ada percobaan yang lebih baru
    clearTimeout(pengingat);
    bersihkanPesan();
    el('cobaLagi').classList.add('sembunyi');
    // Pembimbing kedua sampai kelima sebuah kegiatan bersama juga berhak masuk,
    // jadi yang dikumpulkan seluruh pembimbingnya, bukan penanggung jawabnya saja.
    const punyaEkskul = new Set(ekskul.filter(e => e.aktif !== false).flatMap(pembimbingDari));
    const daftar = pembina.filter(p => punyaEkskul.has(p.id));
    el('pilihNama').innerHTML = daftar.map(p => `<option value="${p.id}">${p.nama}</option>`).join('')
      || '<option value="">Belum ada pembina terdaftar</option>';
  } catch (e) {
    if (ke !== percobaan) return;
    clearTimeout(pengingat);
    el('pilihNama').innerHTML = '<option value="">Gagal memuat</option>';
    el('cobaLagi').classList.remove('sembunyi');
    laporError(e);
  }
}
muatDaftar();

async function masuk() {
  bersihkanPesan();
  try {
    if (peran === 'pengelola') {
      if (el('pinPengelola').value.trim() !== PIN_PENGELOLA)
        throw new Error('PIN pengelola salah.');
      masukSebagai({ peran: 'pengelola', nama: 'Pengelola' });
    } else {
      const id = el('pilihNama').value;
      if (!id) throw new Error('Pilih nama Anda dulu.');
      const p = await cekPembina(id, el('pinPembina').value);
      masukSebagai({ peran: 'pembina', pembina_id: p.id, nama: p.nama });
    }
    location.href = 'index.html';
  } catch (e) { laporError(e); }
}
