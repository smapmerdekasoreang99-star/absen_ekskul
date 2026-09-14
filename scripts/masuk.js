import { ambilMaster, cekPembina } from '../assets/db.js?v=20260913e';
import { masukSebagai, tandaiMode, laporError, bersihkanPesan, PIN_PENGELOLA }
  from '../assets/ui.js?v=20260913e';

const el = id => document.getElementById(id);
let peran = 'pembina';

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
document.addEventListener('keydown', ev => { if (ev.key === 'Enter') masuk(); });

(async function mulai() {
  try {
    const { pembina, ekskul } = await ambilMaster();
    const punyaEkskul = new Set(ekskul.filter(e => e.aktif !== false).map(e => e.pembina_id));
    const daftar = pembina.filter(p => punyaEkskul.has(p.id));
    el('pilihNama').innerHTML = daftar.map(p => `<option value="${p.id}">${p.nama}</option>`).join('')
      || '<option value="">Belum ada pembina terdaftar</option>';
  } catch (e) { laporError(e); }
})();

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
