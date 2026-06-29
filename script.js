// ==========================================
// KONFIGURASI NOTIFIKASI SWEETALERT2
// ==========================================

// 1. Notifikasi Toast (Muncul di pojok kanan atas, otomatis hilang)
const TampilkanToast = (ikon, pesan) => {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer)
            toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
    });
    Toast.fire({
        icon: ikon, // 'success', 'error', 'warning', 'info'
        title: pesan
    });
};

// 2. Notifikasi Modal Alert Standar
const TampilkanAlert = (ikon, judul, pesan) => {
    Swal.fire({
        icon: ikon,
        title: judul,
        text: pesan,
        confirmButtonColor: '#1a365d', // Warna Navy menyesuaikan tema
    });
};

// ==========================================
// PROTEKSI SESSION & LOGOUT LOGIC
// ==========================================
const checkSession = () => {
    const sessionData = localStorage.getItem('currentUser');
    
    // Jika tidak ada data login di browser, kembalikan ke halaman login
    if (!sessionData) {
        window.location.href = 'login.html';
        return null;
    }
    
    return JSON.parse(sessionData);
};

// Jalankan cek sesi segera saat script dimuat
const userMasuk = checkSession();

// Fungsi untuk keluar dari aplikasi
function handleLogout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}

// ==========================================
// KONFIGURASI API
// ==========================================
const API_URL = 'https://script.google.com/macros/s/AKfycbydZOCmWqjzMI3z-3Y0xCFELfSMXBUG9hjQ1IqbXQNLoxK8BJJ74SLDevx6ZfdcTn_L/exec';

// ==========================================
// INISIALISASI APLIKASI ON LOAD
// ==========================================
async function initApp() {
    if (!userMasuk) return;

    // --- BARU: Tampilkan Menu Pengaturan hanya jika Super Admin ---
    const menuPengaturan = document.getElementById('menu-item-pengaturan');
    if (menuPengaturan && userMasuk.role === 'Super Admin') {
        menuPengaturan.style.display = 'block';
    }

    // Pasang event listener untuk tracking live penenomoran surat keluar
    susunEventLivePreview();

    // Default view saat pertama kali load adalah dashboard
    switchView('dashboard');

    muatReferensiGlobal();
}

// Jalankan fungsi saat halaman selesai dimuat
document.addEventListener('DOMContentLoaded', initApp);

// ==========================================
// LOGIKA DASHBOARD UTAMA
// ==========================================
function tampilkanDashboard() {
    // Tampilkan nama profil dan role di header dashboard secara dinamis
    const welcomeNameEl = document.getElementById('welcomeName');
    const userRoleEl = document.getElementById('userRole');

    if (welcomeNameEl) welcomeNameEl.innerHTML = `Selamat Datang, <strong>${userMasuk.nama}</strong>`;
    if (userRoleEl) userRoleEl.innerText = userMasuk.role;
    
    // Jalankan penarikan data angka dan aktivitas
    loadDashboardData();
}

async function loadDashboardData() {
    try {
        // 1. Tarik ke-4 data modul secara paralel (Super Cepat)
        const [resMasuk, resKeluar, resKeputusan, resPerjadin] = await Promise.all([
            fetch(`${API_URL}?action=readSuratMasuk`).then(r => r.json()),
            fetch(`${API_URL}?action=readSuratKeluar`).then(r => r.json()),
            fetch(`${API_URL}?action=readSuratKeputusan`).then(r => r.json()),
            fetch(`${API_URL}?action=readSuratPerjadin`).then(r => r.json())
        ]);
        
        const dataMasuk = resMasuk.status === 'success' ? resMasuk.data : [];
        const dataKeluar = resKeluar.status === 'success' ? resKeluar.data : [];
        const dataKeputusan = resKeputusan.status === 'success' ? resKeputusan.data : [];
        const dataPerjadin = resPerjadin.status === 'success' ? resPerjadin.data : [];
        
        // 2. Siapkan parameter waktu saat ini
        const dateSkg = new Date();
        const tahunSkg = dateSkg.getFullYear().toString(); // "2026"
        const tahunBulanSkg = dateSkg.toLocaleDateString('sv-SE').substring(0, 7); // "2026-06"
        
        // Helper: Fungsi filter hitung statistik Bulanan & Tahunan
        function hitungStatistik(dataArray, fieldTanggal) {
            let countBulan = 0; let countTahun = 0;
            dataArray.forEach(s => {
                const tgl = s[fieldTanggal] || (s.Timestamp ? s.Timestamp.split(' ')[0] : '');
                if (tgl.includes(tahunBulanSkg)) countBulan++;
                if (tgl.includes(tahunSkg)) countTahun++;
            });
            return { bulan: countBulan, tahun: countTahun };
        }

        const statMasuk = hitungStatistik(dataMasuk, 'Tanggal Surat');
        const statKeluar = hitungStatistik(dataKeluar, 'Tanggal Surat');
        const statKeputusan = hitungStatistik(dataKeputusan, 'Tanggal Surat');
        const statPerjadin = hitungStatistik(dataPerjadin, 'Tanggal Berangkat');

        // 3. Tembakkan angka-angka hasil hitung ke ID elemen HTML Dashboard
        document.getElementById('countMasukBulan').innerText = statMasuk.bulan;
        document.getElementById('countMasukTahun').innerText = statMasuk.tahun;
        document.getElementById('countKeluarBulan').innerText = statKeluar.bulan;
        document.getElementById('countKeluarTahun').innerText = statKeluar.tahun;
        document.getElementById('countKeputusanBulan').innerText = statKeputusan.bulan;
        document.getElementById('countKeputusanTahun').innerText = statKeputusan.tahun;
        document.getElementById('countPerjadinBulan').innerText = statPerjadin.bulan;
        document.getElementById('countPerjadinTahun').innerText = statPerjadin.tahun;
        
    } catch (error) {
        console.error('Gagal memuat data dashboard:', error);
        TampilkanToast('error', 'Gagal memuat ringkasan. Pastikan koneksi internet stabil.');
    }
}

// ==========================================
// PENGATURAN ROUTING LAYOUT (SWITCH VIEW)
// ==========================================
function switchView(viewName) {
    // 1. Sembunyikan semua section
    const views = document.querySelectorAll('.app-view');
    views.forEach(view => view.style.display = 'none');

    // 2. Tampilkan section yang dituju
    const targetView = document.getElementById(`view-surat-${viewName}`) || document.getElementById(`view-${viewName}`);
    if (targetView) targetView.style.display = 'block';

    // 3. Hapus status aktif dari semua menu
    const navItems = document.querySelectorAll('.nav-links a');
    navItems.forEach(item => item.classList.remove('active'));

    // 4. Tambahkan status aktif ke menu yang diklik
    const activeMenu = document.getElementById(`menu-${viewName}`);
    if (activeMenu) activeMenu.classList.add('active');

    // 5. Logika Eksekusi berdasarkan Modul
    if (viewName === 'dashboard') {
        // Pembaruan UI Nama dan Role Admin
        const welcomeNameEl = document.getElementById('welcomeName');
        const userRoleEl = document.getElementById('userRole');
        
        if (welcomeNameEl && userMasuk && userMasuk.nama) {
            welcomeNameEl.innerHTML = `Selamat Datang, <strong>${userMasuk.nama}</strong>`;
        }
        if (userRoleEl && userMasuk && userMasuk.role) {
            userRoleEl.innerText = userMasuk.role;
        }

        if (!isDashboardLoaded) {
            loadDashboardData();
            isDashboardLoaded = true;
        }
    } else if (viewName === 'pengaturan') {
        // Biarkan kosong. Data pengaturan akan ditarik otomatis saat Super Admin mengklik akordion.
        if (typeof muatReferensiGlobal === 'function') muatReferensiGlobal();
    } else {
        // Tarik data referensi dropdown secara senyap
        if (typeof muatReferensiGlobal === 'function') muatReferensiGlobal();

        // Jika data memori tabel lokal masih kosong, tarik dari server
        if (masterDataSurat[viewName] && masterDataSurat[viewName].length === 0) {
            fetchDataFromServer(viewName);
        } else {
            // Jika sudah ada di memori, langsung render tabel
            prosesDanRenderTabel(viewName);
        }
    }
}

// Fungsi pembantu untuk tombol Quick Action di Dashboard
function bukaQuickForm(modul) {
    // Pindah tampilan terlebih dahulu
    switchView(modul);
    
    // Pastikan akordion formulir langsung terbuka
    const cardForm = document.getElementById(`card-form-${modul}`);
    if (cardForm && cardForm.classList.contains('collapsible-collapsed')) {
        toggleAkordion(modul);
    }
}

// ==========================================
// ANIMASI KONTROL AKORDION FORMULIR
// ==========================================
function toggleAkordion(modul) {
    const cardForm = document.getElementById(`card-form-${modul}`);
    const btnToggle = document.getElementById(`btnToggle${modul.charAt(0).toUpperCase() + modul.slice(1)}`);
    
    if (!cardForm) return;

    const isCollapsed = cardForm.classList.contains('collapsible-collapsed');

    if (isCollapsed) {
        // Buka Akordion
        cardForm.classList.remove('collapsible-collapsed');
        cardForm.style.maxHeight = "5000px"; // Beri ruang max-height yang cukup
        if (btnToggle) {
            btnToggle.innerHTML = `<span>➖</span> Tutup Formulir`;
        }
        
        // Setup nilai default jika form baru dibuka dan dalam keadaan kosong (bukan mode edit)
        if (modul === 'keluar' && !document.getElementById('keluar-id').value) {
            initDefaultSuratKeluar();
        }
    } else {
        // Tutup Akordion
        cardForm.classList.add('collapsible-collapsed');
        cardForm.style.maxHeight = "0";
        
        // KEMBALIKAN TEKS FORM KEMBALI KE DEFAULT
        document.getElementById(`form-surat-${modul}`).reset();
        document.getElementById(`${modul}-id`).value = ""; 
        
        // --- TAMBAHAN RESET KHUSUS PERJADIN ---
        if (modul === 'perjadin') {
            arrayPelaksanaPerjadin = [];
            renderDaftarPelaksana();
            toggleFormAsal('ts'); // Kembalikan default tampilan TS
            toggleFormAsal('spt'); // Kembalikan default tampilan SPT
            
            // --- KODE TAMBAHAN UNTUK RESET TOGGLE ---
            ['ts', 'spt', 'sppd'].forEach(f => {
                const radioUpload = document.querySelector(`input[name="method-perjadin-${f}"][value="upload"]`);
                if (radioUpload) {
                    radioUpload.checked = true;
                    switchFileMethod(`perjadin-${f}`, 'upload');
                }
                const btnUpload = document.getElementById(`btn-upload-perjadin-${f}`);
                const statusUpload = document.getElementById(`status-upload-perjadin-${f}`);
                if (btnUpload) btnUpload.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Unggah';
                if (statusUpload) statusUpload.innerHTML = '<span style="color: #64748b; font-style: italic;">Pilih file lalu klik Unggah.</span>';
            });
            // ----------------------------------------
        }
        
        // --- PERBAIKAN: RESET JUDUL & TOMBOL SECARA DINAMIS ---
        const titleElement = document.getElementById(`title-form-${modul}`);
        const btnSubmitElement = document.getElementById(`btn-submit-${modul}`);
        let textToggle = '';

        if (modul === 'masuk') {
            if (titleElement) titleElement.innerText = 'Registrasi Surat Masuk';
            if (btnSubmitElement) btnSubmitElement.innerText = 'Simpan Data';
            textToggle = 'Surat Masuk';
        } else if (modul === 'keluar') {
            if (titleElement) titleElement.innerText = 'Registrasi Surat Keluar';
            if (btnSubmitElement) btnSubmitElement.innerText = 'Simpan Data';
            textToggle = 'Surat Keluar';
        } else if (modul === 'keputusan') {
            if (titleElement) titleElement.innerText = 'Registrasi Surat Keputusan';
            if (btnSubmitElement) btnSubmitElement.innerText = 'Simpan Data';
            textToggle = 'Surat Keputusan';
        } else if (modul === 'perjadin') {
            if (titleElement) titleElement.innerText = 'Registrasi Perjalanan Dinas';
            if (btnSubmitElement) btnSubmitElement.innerText = 'Simpan Data';
            textToggle = 'Perjadin';
        }

        if (btnToggle) {
            btnToggle.innerHTML = `<span>➕</span> Registrasi ${textToggle}`;
        }
    }
}

// ==========================================
// LOGIKA LIVE PREVIEW NOMOR SURAT KELUAR
// ==========================================
// Helper untuk merapikan nomor urut (contoh: "39a" -> "039A", "40.b" -> "040.B")
function formatNomorUrut(input) {
    let str = input.toString().trim().toUpperCase();
    // Pisahkan bagian angka di depan dan bagian teks/simbol di belakang
    let match = str.match(/^(\d+)(.*)$/);
    if (match) {
        let numPart = match[1].padStart(3, '0');
        let textPart = match[2];
        return numPart + textPart;
    }
    return str.padStart(3, '0'); // Fallback jika format tidak dikenali
}

// Logika Live Preview Dinamis
function updateLivePreviewNomor(modul) {
    const kode = document.getElementById(`${modul}-kode`).value || '...';
    const lanjutan = document.getElementById(`${modul}-lanjutan`).value || '...';
    
    // Khusus Perjadin TS & SPT, kita ambil tahun spesifik dari kolomnya
    const elTahun = document.getElementById(`${modul}-tahun`);
    const tahun = elTahun ? (elTahun.value || new Date().getFullYear()) : new Date().getFullYear();
    
    const urutMentah = document.getElementById(`${modul}-urut`).value;
    const urutFormat = urutMentah ? formatNomorUrut(urutMentah) : '...';

    const previewBox = document.getElementById(`${modul}-preview-nomor`);
    if (previewBox) {
        previewBox.innerText = `${kode}/${urutFormat}/${lanjutan}/${tahun}`;
    }
}

// Set nilai default awal untuk Surat Keluar baru
function initDefaultSuratKeluar() {
    const txtLanjutan = document.getElementById('keluar-lanjutan');
    const txtTahun = document.getElementById('keluar-tahun');
    const txtTgl = document.getElementById('keluar-tgl');

    if (txtLanjutan && !txtLanjutan.value) txtLanjutan.value = 'KEC.LPHG-BLG';
    if (txtTahun && !txtTahun.value) txtTahun.value = '2026';
    if (txtTgl && !txtTgl.value) {
        txtTgl.value = new Date().toLocaleDateString('sv-SE');
    }

    // Trigger preview awal
    updateLivePreviewNomor('keluar'); // <-- PERBAIKAN: Tambahkan 'keluar' di dalam kurung
}

// Menghubungkan element input ke fungsi Live Preview
function susunEventLivePreview() {
    const inputsKeluar = ['keluar-kode', 'keluar-urut', 'keluar-lanjutan', 'keluar-tahun'];
    inputsKeluar.forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('input', () => updateLivePreviewNomor('keluar')); });

    const inputsKeputusan = ['keputusan-kode', 'keputusan-urut', 'keputusan-lanjutan', 'keputusan-tahun'];
    inputsKeputusan.forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('input', () => updateLivePreviewNomor('keputusan')); });

    // Tambahan untuk modul Perjadin (TS & SPT)
    const inputsTS = ['perjadin-ts-kode', 'perjadin-ts-urut', 'perjadin-ts-lanjutan', 'perjadin-ts-tahun'];
    inputsTS.forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('input', () => updateLivePreviewNomor('perjadin-ts')); });

    const inputsSPT = ['perjadin-spt-kode', 'perjadin-spt-urut', 'perjadin-spt-lanjutan', 'perjadin-spt-tahun'];
    inputsSPT.forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('input', () => updateLivePreviewNomor('perjadin-spt')); });
}

// ==========================================
// SWITCH METODE LAMPIRAN (FILE / URL)
// ==========================================
function switchFileMethod(modul, method) {
    const containerUpload = document.getElementById(`input-upload-${modul}`);
    const containerUrl = document.getElementById(`input-url-${modul}`);
    
    if (method === 'upload') {
        if (containerUpload) containerUpload.style.display = 'block';
        if (containerUrl) containerUrl.style.display = 'none';
        // Bersihkan nilai input URL jika pindah ke opsi upload
        const inputUrl = document.getElementById(`${modul}-url`);
        if (inputUrl) inputUrl.value = '';
    } else {
        if (containerUpload) containerUpload.style.display = 'none';
        if (containerUrl) containerUrl.style.display = 'block';
        // Bersihkan nilai input file jika pindah ke opsi URL
        const inputFile = document.getElementById(`${modul}-file`);
        if (inputFile) inputFile.value = '';
    }
}

// Variabel global untuk menyimpan data referensi kode dari server
let daftarReferensiKode = [];
let daftarPegawai = [];

// Variabel status global untuk melacak proses unduhan
let statusMemuatReferensi = false;
let referensiSudahDimuat = false;

// ==========================================
// PRE-LOADING REFERENSI (BERGERAK DI LATAR BELAKANG)
// ==========================================
async function muatReferensiGlobal() {
    // Cegah sistem melakukan fetch ganda jika sedang atau sudah memuat
    if (referensiSudahDimuat || statusMemuatReferensi) return;
    
    statusMemuatReferensi = true;

    try {
        const response = await fetch(`${API_URL}?action=getDropdownOptions`);
        const result = await response.json();

        if (result.status === 'success') {
            referensiSudahDimuat = true;
            
            // 1. Simpan ke memori lokal
            if (result.data.kode_surat) daftarReferensiKode = result.data.kode_surat;
            if (result.data.pegawai) daftarPegawai = result.data.pegawai;

            // 2. Isi dropdown jenis surat (Kecuali Perjadin yang sudah di-hardcode di HTML)
            const selects = ['masuk-jenis', 'keluar-jenis'];
            selects.forEach(id => {
                const selectEl = document.getElementById(id);
                if (selectEl) {
                    selectEl.innerHTML = '<option value="">-- Pilih --</option>';
                    result.data.jenis_surat.forEach(jenis => {
                        const opt = document.createElement('option');
                        opt.value = jenis;
                        opt.innerText = jenis;
                        selectEl.appendChild(opt);
                    });
                }
            });

            // 3. AUTO-UPDATE UI: Jika pengguna terlalu cepat mengklik modal sebelum data tiba,
            // sistem akan otomatis merender isi modal seketika data ini mendarat!
            if (document.getElementById('modalKlasifikasi').style.display === 'flex') {
                renderModalKlasifikasi(daftarReferensiKode);
            }
            if (document.getElementById('modalPegawai').style.display === 'flex') {
                renderModalPegawai(daftarPegawai);
            }
        }
    } catch (error) {
        console.error('Gagal memuat data referensi:', error);
    } finally {
        statusMemuatReferensi = false; // Lepas kunci status
    }
}

// ==========================================
// SINKRONISASI REFERENSI (MANUAL REFRESH)
// ==========================================
async function sinkronReferensi() {
    const btnSync = document.getElementById('btnSyncReferensi');
    
    // Aktifkan animasi putar pada ikon dan nonaktifkan tombol sementara
    if (btnSync) {
        btnSync.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> Menyinkronkan...';
        btnSync.disabled = true;
    }
    
    TampilkanToast('info', 'Mengambil data referensi terbaru dari server...');
    
    try {
        const response = await fetch(`${API_URL}?action=getDropdownOptions`);
        const result = await response.json();

        if (result.status === 'success') {
            // 1. Perbarui Dropdown Jenis Surat (Masuk & Keluar)
            const selects = ['masuk-jenis', 'keluar-jenis'];
            selects.forEach(id => {
                const selectEl = document.getElementById(id);
                if (selectEl) {
                    // Kosongkan opsi lama, sisakan opsi default "-- Pilih --"
                    selectEl.innerHTML = '<option value="">-- Pilih --</option>';
                    
                    // Masukkan opsi yang baru
                    result.data.jenis_surat.forEach(jenis => {
                        const opt = document.createElement('option');
                        opt.value = jenis;
                        opt.innerText = jenis;
                        selectEl.appendChild(opt);
                    });
                }
            });

            // 2. Perbarui Referensi Kode Surat Klasifikasi
            if (result.data.kode_surat) {
                daftarReferensiKode = result.data.kode_surat;
                renderModalKlasifikasi(daftarReferensiKode);
            }
            
            TampilkanToast('success', 'Opsi Jenis & Kode Surat berhasil diperbarui!');
        } else {
            TampilkanToast('error', 'Gagal menyinkron data referensi.');
        }
    } catch (error) {
        console.error('Error sinkron:', error);
        TampilkanToast('error', 'Gangguan koneksi saat menyinkron.');
    } finally {
        // Kembalikan tombol ke keadaan semula
        if (btnSync) {
            btnSync.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Sinkron Referensi';
            btnSync.disabled = false;
        }
    }
}

// ==========================================
// MANAJEMEN MODAL REFERENSI KODE KLASIFIKASI
// ==========================================
// Variabel global penanda modul mana yang sedang mencari kode
let targetModulKlasifikasi = ''; 

function bukaModalKlasifikasi(modul) {
    targetModulKlasifikasi = modul || 'keluar'; // Simpan nama modul (default 'keluar' jika kosong)
    const modal = document.getElementById('modalKlasifikasi');
    if (modal) {
        document.getElementById('searchKodeInput').value = ''; // Bersihkan kolom pencarian
        renderModalKlasifikasi(daftarReferensiKode); // Munculkan semua daftar awal
        modal.style.display = 'flex';
    }
}

function tutupModalKlasifikasi() {
    const modal = document.getElementById('modalKlasifikasi');
    if (modal) modal.style.display = 'none';
}

// Merender daftar kode ke dalam komponen list UI modal
function renderModalKlasifikasi(data) {
    const listContainer = document.getElementById('listaKodeKlasifikasi');
    if (!listContainer) return;

    if (data.length === 0) {
        if (statusMemuatReferensi) {
            listContainer.innerHTML = '<li class="loading-item" style="text-align: center; padding: 25px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: #2563eb; margin-bottom: 15px;"></i><br><span style="color: #64748b;">Sedang menyinkronkan data...</span></li>';
        } else {
            listContainer.innerHTML = '<li class="loading-item">Tidak ada data kode surat. Silakan klik Sinkron Referensi.</li>';
        }
        return;
    }

    listContainer.innerHTML = data.map(item => `
        <li class="kode-item" onclick="pilihKodeReferensi('${item.kode}')">
            <span class="kode-num">${item.kode}</span>
            <span class="kode-text">${item.ket}</span>
        </li>
    `).join('');
}

// Fungsi ketika salah satu baris kode di dalam modal dipilih/di-klik
function pilihKodeReferensi(kodeTerpilih) {
    // 1. Cari elemen input berdasar modul yang membuka modal
    const inputKode = document.getElementById(`${targetModulKlasifikasi}-kode`);
    
    if (inputKode) {
        // 2. Masukkan kode ke kotak input
        inputKode.value = kodeTerpilih; 
        
        // 3. Trigger live preview agar kotak nomor lengkap langsung berkedip terupdate
        updateLivePreviewNomor(targetModulKlasifikasi); 
    }
    
    // 4. Tutup otomatis modalnya
    tutupModalKlasifikasi(); 
}

// Fitur live filter pencarian di dalam modal referensi
function filterKodeKlasifikasi() {
    const keyword = document.getElementById('searchKodeInput').value.toLowerCase();
    const hasilFilter = daftarReferensiKode.filter(item => 
        item.kode.toLowerCase().includes(keyword) || 
        item.ket.toLowerCase().includes(keyword)
    );
    renderModalKlasifikasi(hasilFilter);
}

// ==========================================
// HELPER: KONVERSI FILE KE BASE64
// ==========================================
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// ==========================================
// LOGIKA PENGIRIMAN FORMULIR (SIMPAN / EDIT)
// ==========================================
async function handleSimpanSurat(event, modul) {
    event.preventDefault();

    const btnSubmit = document.getElementById(`btn-submit-${modul}`);
    const originalText = btnSubmit.innerText;
    
    // AKTIFKAN SPINNER DI TOMBOL SIMPAN
    btnSubmit.innerHTML = `<span class="spinner"></span> Memproses...`;
    btnSubmit.disabled = true;

    try {
        const currentId = document.getElementById(`${modul}-id`).value;
        const isEditMode = currentId !== "";

        // ==========================================
        // PERBAIKAN 1: LOGIKA PENENTUAN ACTION API
        // ==========================================
        let actionTarget = '';
        if (modul === 'masuk') {
            actionTarget = isEditMode ? 'updateSuratMasuk' : 'addSuratMasuk';
        } else if (modul === 'keluar') {
            actionTarget = isEditMode ? 'updateSuratKeluar' : 'addSuratKeluar';
        } else if (modul === 'keputusan') {
            actionTarget = isEditMode ? 'updateSuratKeputusan' : 'addSuratKeputusan'; // <-- Arahkan ke SK
        } else if (modul === 'perjadin') {
            // ---> INI YANG HARUS DITAMBAHKAN <---
            actionTarget = isEditMode ? 'updateSuratPerjadin' : 'addSuratPerjadin'; 
        }

        const payload = {
            id: currentId, 
            action: actionTarget,
            username: userMasuk ? userMasuk.username : '',
            role: userMasuk ? userMasuk.role : ''
        };

        if (modul !== 'perjadin') {
            payload.tanggalSurat = document.getElementById(`${modul}-tgl`) ? document.getElementById(`${modul}-tgl`).value : '';
            payload.jenisSurat = document.getElementById(`${modul}-jenis`) ? document.getElementById(`${modul}-jenis`).value : '';
            payload.perihal = document.getElementById(`${modul}-perihal`) ? document.getElementById(`${modul}-perihal`).value : '';
            payload.keterangan = document.getElementById(`${modul}-keterangan`) ? document.getElementById(`${modul}-keterangan`).value : '';
        }

        // ==========================================
        // PERBAIKAN 2: AMBIL NILAI INPUT SPESIFIK MODUL
        // ==========================================
        if (modul === 'masuk') {
            payload.nomorSurat = document.getElementById('masuk-nomor').value.trim();
            payload.asal = document.getElementById('masuk-asal').value.trim();
            
        } else if (modul === 'keluar') {
            payload.kodeSurat = document.getElementById('keluar-kode').value.trim();
            payload.nomorUrut = document.getElementById('keluar-urut').value.trim();
            payload.kodeLanjutan = document.getElementById('keluar-lanjutan').value.trim();
            payload.tahunSurat = document.getElementById('keluar-tahun').value.trim();
            payload.tujuan = document.getElementById('keluar-tujuan').value.trim();
            
        } else if (modul === 'keputusan') {
            payload.kodeSurat = document.getElementById('keputusan-kode').value.trim();
            payload.nomorUrut = document.getElementById('keputusan-urut').value.trim();
            payload.kodeLanjutan = document.getElementById('keputusan-lanjutan').value.trim();
            payload.tahunSurat = document.getElementById('keputusan-tahun').value.trim();
            payload.tujuan = document.getElementById('keputusan-tujuan').value.trim(); // <-- Ini baris yang ditambahkan

        } else if (modul === 'perjadin') {
            // 1. Tangkap Info Kegiatan
            payload.jenisPerjadin = document.getElementById('perjadin-jenis').value.trim();
            payload.tglBerangkat = document.getElementById('perjadin-tgl-berangkat').value;
            payload.tglKembali = document.getElementById('perjadin-tgl-kembali').value;
            payload.lamaHari = document.getElementById('perjadin-lama-hari').value.replace(' Hari', '').trim();
            payload.maksud = document.getElementById('perjadin-maksud').value.trim();
            payload.tujuanKantor = document.getElementById('perjadin-kantor-tujuan').value.trim();
            payload.tujuanDaerah = document.getElementById('perjadin-daerah-tujuan').value.trim();

            // 2. Tangkap Data Dasar (TS & SPT) - Cek Internal/Eksternal
            const asalTS = document.getElementById('perjadin-ts-asal').value;
            if (asalTS === 'Internal') {
                // Terapkan fungsi pemoles formatNomorUrut di sini
                const urutTSFormat = formatNomorUrut(document.getElementById('perjadin-ts-urut').value);
                payload.nomorTS = `${document.getElementById('perjadin-ts-kode').value}/${urutTSFormat}/${document.getElementById('perjadin-ts-lanjutan').value}/${document.getElementById('perjadin-ts-tahun').value}`;
            } else {
                payload.nomorTS = document.getElementById('perjadin-ts-lengkap').value;
            }

            const asalSPT = document.getElementById('perjadin-spt-asal').value;
            if (asalSPT === 'Internal') {
                // Terapkan fungsi pemoles formatNomorUrut di sini
                const urutSPTFormat = formatNomorUrut(document.getElementById('perjadin-spt-urut').value);
                payload.nomorSPT = `${document.getElementById('perjadin-spt-kode').value}/${urutSPTFormat}/${document.getElementById('perjadin-spt-lanjutan').value}/${document.getElementById('perjadin-spt-tahun').value}`;
            } else {
                payload.nomorSPT = document.getElementById('perjadin-spt-lengkap').value;
            }

            // 3. Tangkap JSON Array Pelaksana & SPPD
            const dataPelaksana = document.getElementById('perjadin-data-pelaksana').value;
            if (dataPelaksana === "[]" || !dataPelaksana) {
                TampilkanToast('warning', 'Daftar pelaksana kosong! Tambahkan minimal 1 pegawai.');
                btnSubmit.innerText = originalText;
                btnSubmit.disabled = false;
                return; // Hentikan simpan jika tidak ada pegawai
            }
            payload.dataPelaksanaJSON = dataPelaksana;

            // 4. Validasi 3 Tombol Lampiran File Perjadin (Cek Upload vs URL)
            const filesToCheck = ['ts', 'spt', 'sppd'];
            for (let f of filesToCheck) {
                const methodFile = document.querySelector(`input[name="method-perjadin-${f}"]:checked`);
                const methodVal = methodFile ? methodFile.value : 'upload';

                if (methodVal === 'upload') {
                    const inputEl = document.getElementById(`perjadin-${f}-file`);
                    const hiddenUrl = document.getElementById(`perjadin-${f}-file-url`);
                    
                    // Jika memilih unggah tapi file dimasukkan tanpa ditekan tombol Unggah biru
                    if (inputEl && inputEl.files.length > 0 && hiddenUrl.value === "") {
                        TampilkanToast('error', `File ${f.toUpperCase()} belum diunggah! Klik tombol biru "Unggah ${f.toUpperCase()}".`);
                        btnSubmit.innerText = originalText;
                        btnSubmit.disabled = false;
                        return;
                    }
                    payload[`url_${f}`] = hiddenUrl ? hiddenUrl.value : '';
                } else {
                    // Jika menggunakan metode tempel URL manual
                    const manualUrl = document.getElementById(`perjadin-${f}-url`);
                    payload[`url_${f}`] = manualUrl ? manualUrl.value.trim() : '';
                }
            }
        }

        // 4. Logika Pemrosesan Lampiran File (Hanya untuk Masuk, Keluar, dan SK)
        if (modul !== 'perjadin') {
            const methodFile = document.querySelector(`input[name="method-${modul}"]:checked`);
            
            // Kita tidak lagi mengirim base64 bersamaan dengan form
            payload.file = null; 
            payload.fileUrl = '';

            // Pastikan elemen methodFile ditemukan (mencegah error null)
            if (methodFile) {
                if (methodFile.value === 'upload') {
                    const fileInput = document.getElementById(`${modul}-file`);
                    const hiddenUrl = document.getElementById(`${modul}-file-url`);
                    
                    // Jika pengguna memilih sebuah file...
                    if (fileInput && fileInput.files.length > 0) {
                        // ...maka sistem mencegat jika URL dari tombol unggah masih kosong
                        if (hiddenUrl.value === "") {
                            TampilkanToast('warning', 'File belum diunggah! Klik tombol "Unggah" berwarna biru terlebih dahulu.');
                            btnSubmit.innerText = originalText;
                            btnSubmit.disabled = false;
                            return; // Hentikan proses simpan
                        }
                        // Jika sudah berhasil diunggah, ambil URL-nya
                        payload.fileUrl = hiddenUrl.value;
                    }
                } else {
                    // Jika memilih tempel URL manual
                    payload.fileUrl = document.getElementById(`${modul}-url`).value.trim();
                }
            }
        }

        // 5. Kirim data ke GAS
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.status === 'success') {
            TampilkanAlert('success', 'Berhasil Disimpan!', result.data.message);
            
            document.getElementById(`form-surat-${modul}`).reset();
            toggleAkordion(modul);
            
            if (typeof loadDashboardData === 'function') loadDashboardData();
            
            // Refresh tabel sesuai modul
            fetchDataFromServer(modul); 
            
        } else {
            TampilkanAlert('error', 'Gagal', result.message);
        }
    } catch (error) {
        TampilkanToast('error', 'Terjadi kesalahan koneksi sistem.');
    } finally {
        btnSubmit.innerText = originalText;
        btnSubmit.disabled = false;
    }
}

function renderBarisSuratMasuk(dataRows) {
    const container = document.getElementById('tabel-surat-masuk');
    if (dataRows.length === 0) {
        container.innerHTML = '<p class="empty-text">Belum ada Surat Masuk yang diregistrasi.</p>';
        return;
    }

    let html = `<div class="responsive-table-wrapper"><table class="seamless-table">
        <thead><tr>
            <th style="width: 22%">Tanggal & Nomor Surat</th>
            <th style="width: 35%">Jenis & Perihal</th>
            <th style="width: 18%">Asal</th>
            <th style="width: 15%">Keterangan</th>
            <th style="width: 10%; text-align: center;">Aksi</th>
        </tr></thead><tbody>`;

    dataRows.forEach(surat => {
        const punyaAkses = userMasuk.role === 'Super Admin' || userMasuk.username === surat.Penginput;
        const tglBersih = surat['Tanggal Surat'] ? surat['Tanggal Surat'].split('T')[0] : '-';
        const tombolPreview = surat['URL File'] ? `<button class="btn-icon-action preview" onclick="bukaPreviewModal('${surat['URL File']}')" title="Pratinjau File"><i class="fa-solid fa-eye"></i></button>` : '';

        html += `<tr>
            <td><div class="cell-stacked"><span class="cell-date">${tglBersih}</span><span class="cell-main-text" style="font-weight: 600;">${surat['Nomor Surat'] || '-'}</span></div></td>            <td><div class="cell-stacked"><div><span class="badge-jenis-surat badge-masuk">${surat['Jenis Surat'] || 'Surat'}</span></div><span class="cell-sub-text">${surat['Perihal/Deskripsi'] || '-'}</span></div></td>
            <td><span class="cell-normal-text">${surat['Asal/Pengirim'] || '-'}</span></td>
            <td><span class="cell-muted-text">${surat['Keterangan'] || '-'}</span></td>
            <td class="text-center"><div class="table-icon-group">
                ${tombolPreview}
                ${punyaAkses ? `
                    <button class="btn-icon-action edit" onclick="bukaEditMasuk(${JSON.stringify(surat).replace(/"/g, '&quot;')})"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn-icon-action delete" onclick="hapusSurat('masuk', '${surat.ID}')"><i class="fa-solid fa-trash-can"></i></button>
                ` : ''}
            </div></td>
        </tr>`;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function renderBarisSuratKeluar(dataRows) {
    const container = document.getElementById('tabel-surat-keluar');
    if (dataRows.length === 0) {
        container.innerHTML = '<p class="empty-text">Belum ada Surat Keluar yang diregistrasi.</p>';
        return;
    }

    let html = `<div class="responsive-table-wrapper"><table class="seamless-table">
        <thead><tr>
            <th style="width: 25%">Tanggal & Nomor Surat</th>
            <th style="width: 32%">Jenis & Perihal</th>
            <th style="width: 18%">Tujuan</th>
            <th style="width: 15%">Keterangan</th>
            <th style="width: 10%; text-align: center;">Aksi</th>
        </tr></thead><tbody>`;

    dataRows.forEach(surat => {
        const punyaAkses = userMasuk.role === 'Super Admin' || userMasuk.username === surat.Penginput;
        const tglBersih = surat['Tanggal Surat'] ? surat['Tanggal Surat'].split('T')[0] : '-';
        const tombolPreview = surat['URL File'] ? `<button class="btn-icon-action preview" onclick="bukaPreviewModal('${surat['URL File']}')" title="Pratinjau File"><i class="fa-solid fa-eye"></i></button>` : '';

        html += `<tr>
            <td>
                <div class="cell-stacked">
                    <span class="cell-date">${tglBersih}</span>
                    <span class="cell-main-text" style="font-weight: 600;">${highlightNomorUrut(surat['Nomor Surat Lengkap'] || '-')}</span>
                </div>
            </td>
            <td><div class="cell-stacked"><div><span class="badge-jenis-surat badge-keluar">${surat['Jenis Surat'] || 'Surat'}</span></div><span class="cell-sub-text">${surat['Perihal/Deskripsi'] || '-'}</span></div></td>
            <td><span class="cell-normal-text">${surat['Tujuan/Penerima'] || '-'}</span></td>
            <td><span class="cell-muted-text">${surat['Keterangan'] || '-'}</span></td>
            <td class="text-center"><div class="table-icon-group">
                ${tombolPreview}
                ${punyaAkses ? `
                    <button class="btn-icon-action edit" onclick="bukaEditKeluar(${JSON.stringify(surat).replace(/"/g, '&quot;')})"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn-icon-action delete" onclick="hapusSurat('keluar', '${surat.ID}')"><i class="fa-solid fa-trash-can"></i></button>
                ` : ''}
            </div></td>
        </tr>`;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function renderBarisSuratKeputusan(dataRows) {
    const container = document.getElementById('tabel-surat-keputusan');
    if (dataRows.length === 0) {
        container.innerHTML = '<p class="empty-text">Belum ada Surat Keputusan yang diregistrasi.</p>';
        return;
    }

    let html = `<div class="responsive-table-wrapper"><table class="seamless-table">
        <thead><tr>
            <th style="width: 25%">Tanggal & Nomor SK</th>
            <th style="width: 32%">Tentang</th>
            <th style="width: 18%">Penerima SK</th>
            <th style="width: 15%">Keterangan</th>
            <th style="width: 10%; text-align: center;">Aksi</th>
        </tr></thead><tbody>`;

    dataRows.forEach(surat => {
        const punyaAkses = userMasuk.role === 'Super Admin' || userMasuk.username === surat.Penginput;
        const tglBersih = surat['Tanggal Surat'] ? surat['Tanggal Surat'].split('T')[0] : '-';
        const tombolPreview = surat['URL File'] ? `<button class="btn-icon-action preview" onclick="bukaPreviewModal('${surat['URL File']}')" title="Pratinjau SK"><i class="fa-solid fa-eye"></i></button>` : '';

        html += `<tr>
            <td>
                <div class="cell-stacked">
                    <span class="cell-date">${tglBersih}</span>
                    <span class="cell-main-text" style="font-weight: 600;">${highlightNomorUrut(surat['Nomor Surat Lengkap'] || '-')}</span>
                </div>
            </td>
            <td><div class="cell-stacked"><div><span class="badge-jenis-surat badge-keputusan">Surat Keputusan</span></div><span class="cell-sub-text">${surat['Perihal/Deskripsi'] || '-'}</span></div></td>
            <td><span class="cell-normal-text">${surat['Tujuan/Penerima'] || '-'}</span></td>
            <td><span class="cell-muted-text">${surat['Keterangan'] || '-'}</span></td>
            <td class="text-center"><div class="table-icon-group">
                ${tombolPreview}
                ${punyaAkses ? `
                    <button class="btn-icon-action edit" onclick="bukaEditKeputusan(${JSON.stringify(surat).replace(/"/g, '&quot;')})"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn-icon-action delete" onclick="hapusSurat('keputusan', '${surat.ID}')"><i class="fa-solid fa-trash-can"></i></button>
                ` : ''}
            </div></td>
        </tr>`;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// ==========================================
// RENDER TABEL SURAT PERJADIN (DESAIN FOKUS)
// ==========================================
function renderBarisSuratPerjadin(dataRows) {
    const container = document.getElementById('tabel-surat-perjadin');
    if (dataRows.length === 0) {
        container.innerHTML = '<p class="empty-text">Belum ada Perjalanan Dinas yang diregistrasi.</p>';
        return;
    }

    let html = `<div class="responsive-table-wrapper"><table class="seamless-table">
        <thead><tr>
            <th style="width: 15%">Jenis Perjadin</th>
            <th style="width: 25%">Maksud & Tujuan</th>
            <th style="width: 15%">Nomor TS</th>
            <th style="width: 15%">Nomor SPT</th>
            <th style="width: 20%">Nomor SPPD & Pelaksana</th>
            <th style="width: 10%; text-align: center;">Aksi</th>
        </tr></thead><tbody>`;

    dataRows.forEach(surat => {
        const punyaAkses = userMasuk.role === 'Super Admin' || userMasuk.username === surat.Penginput;
        const tglBerangkat = surat['Tanggal Berangkat'] ? surat['Tanggal Berangkat'].split('T')[0] : '-';
        
        // Render daftar pelaksana (Jahit ulang kolom array dari Sheet dan Urutkan)
        let htmlPelaksana = '<span class="cell-muted-text">Belum ada pelaksana</span>';
        if (surat['Pelaksana'] && surat['Pelaksana'] !== '-') {
            const arrNama = surat['Pelaksana'].toString().split(';');
            const arrNIP = (surat['NIP'] || '').toString().split(';');
            const arrStatus = (surat['Status'] || '').toString().split(';');
            const arrSPPD = (surat['Nomor SPPD'] || '').toString().split(';');
            
            // 1. Satukan (Zip) kembali menjadi kumpulan objek
            let pelaksanaList = arrNama.map((nama, i) => ({
                nama: nama.trim(),
                nip: (arrNIP[i] || '-').trim(),
                status: (arrStatus[i] || '-').trim(),
                sppd: (arrSPPD[i] || '-').trim()
            }));

            // 2. Lakukan pengurutan (Sort) berdasarkan Nomor SPPD
            pelaksanaList.sort((a, b) => {
                const numA = a.sppd !== '-' && a.sppd !== '' ? a.sppd : 'ZZZ';
                const numB = b.sppd !== '-' && b.sppd !== '' ? b.sppd : 'ZZZ';
                return numA.localeCompare(numB, undefined, { numeric: true, sensitivity: 'base' });
            });

            // 3. Ubah kembali array yang sudah urut menjadi baris HTML
            htmlPelaksana = pelaksanaList.map(p => {
                return `<div style="font-size: 0.85rem; padding: 8px 0; border-bottom: 1px dashed #cbd5e1; display: flex; flex-direction: column; gap: 3px;">
                    <div><span style="background: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 0.85rem; border: 1px solid #c7d2fe;">${p.sppd}</span></div>
                    <strong style="color: #1e293b; font-size: 0.85rem; margin-top: 2px;">${p.nama}</strong>
                    <span style="color: #475569;">${p.nip}</span>
                    <span style="color: #64748b; font-size: 0.7rem; font-style: italic;">${p.status}</span>
                </div>`;
            }).join('');
        }

        // Tombol Pratinjau Cerdas (Memicu Modal Pilihan File 3-in-1)
        const btnPratinjau = (surat['URL TS'] || surat['URL SPT'] || surat['URL SPPD']) 
            ? `<button class="btn-icon-action preview" onclick="bukaPilihanFilePerjadin('${surat['URL TS']}', '${surat['URL SPT']}', '${surat['URL SPPD']}')" title="Pratinjau File"><i class="fa-solid fa-eye"></i></button>` 
            : '';

        html += `<tr>
            <td>
                <div class="cell-stacked">
                    <div><span class="badge-jenis-surat badge-perjadin">${surat['Jenis'] || '-'}</span></div>
                    <span class="cell-sub-text" style="font-size: 0.85rem; margin-top: 5px;"><b>Berangkat:</b><br>${tglBerangkat}</span>
                    <span class="cell-sub-text" style="font-size: 0.85rem; color: #64748b;"><i class="fa-regular fa-clock"></i> ${surat['Lama'] || '-'}</span>
                </div>
            </td>
            <td>
                <div class="cell-stacked">
                    <span class="cell-main-text">${surat['Maksud'] || '-'}</span>
                    <span class="cell-sub-text" style="color: #2563eb; font-weight: 500; font-size: 0.85rem; margin-top: 5px;"><i class="fa-solid fa-location-dot"></i> ${surat['Tujuan'] || '-'}</span>
                </div>
            </td>
            <td><span class="cell-normal-text" style="font-size: 0.85rem; font-weight: 500; word-break: break-all;">${highlightNomorUrut(surat['Nomor TS'])}</span></td>
            <td><span class="cell-normal-text" style="font-size: 0.85rem; font-weight: 500; word-break: break-all;">${highlightNomorUrut(surat['Nomor SPT'])}</span></td>
            <td><div class="cell-stacked">${htmlPelaksana}</div></td>
            <td class="text-center"><div class="table-icon-group">
                ${btnPratinjau}
                ${punyaAkses ? `
                    <button class="btn-icon-action edit" onclick="bukaEditPerjadin(${JSON.stringify(surat).replace(/"/g, '&quot;')})"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn-icon-action delete" onclick="hapusSurat('perjadin', '${surat.ID}')"><i class="fa-solid fa-trash-can"></i></button>
                ` : ''}
            </div></td>
        </tr>`;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// ==========================================
// MENAMPILKAN DATA KE FORM UTK EDIT (PERJADIN)
// ==========================================
function bukaEditPerjadin(surat) {
    const cardForm = document.getElementById('card-form-perjadin');
    if (cardForm.classList.contains('collapsible-collapsed')) {
        toggleAkordion('perjadin');
    }
    
    document.getElementById('title-form-perjadin').innerText = 'Ubah Data Perjalanan Dinas';
    document.getElementById('btn-submit-perjadin').innerText = 'Perbarui Data';
    
    // 1. Info Kegiatan Dasar
    document.getElementById('perjadin-id').value = surat.ID;
    document.getElementById('perjadin-jenis').value = surat['Jenis'] || surat['Jenis Perjadin'] || '';
    document.getElementById('perjadin-tgl-berangkat').value = surat['Tanggal Berangkat'] ? surat['Tanggal Berangkat'].split('T')[0] : '';
    document.getElementById('perjadin-tgl-kembali').value = surat['Tanggal Kembali'] ? surat['Tanggal Kembali'].split('T')[0] : '';
    hitungLamaHariPerjadin(); // Kalkulasi otomatis lama hari
    
    document.getElementById('perjadin-maksud').value = surat['Maksud'] || surat['Maksud Perjadin'] || '';
    
    // Pecah Tujuan kembali menjadi Kantor & Daerah
    const tujuan = surat['Tujuan'] || surat['Tujuan Perjadin'] || '';
    const splitTujuan = tujuan.split(', ');
    if (splitTujuan.length > 1) {
        document.getElementById('perjadin-kantor-tujuan').value = splitTujuan[0];
        document.getElementById('perjadin-daerah-tujuan').value = splitTujuan.slice(1).join(', ');
    } else {
        document.getElementById('perjadin-kantor-tujuan').value = tujuan;
        document.getElementById('perjadin-daerah-tujuan').value = '';
    }

    // 2. Helper untuk mengisi form Nomor TS & SPT (Internal vs Eksternal)
    function setNomorDasar(tipe, nomorLengkap) {
        if (!nomorLengkap || nomorLengkap === '-') {
            document.getElementById(`perjadin-${tipe}-asal`).value = 'Internal';
            toggleFormAsal(tipe);
            return;
        }
        
        const parts = nomorLengkap.split('/');
        if (parts.length === 4) {
            document.getElementById(`perjadin-${tipe}-asal`).value = 'Internal';
            toggleFormAsal(tipe);
            document.getElementById(`perjadin-${tipe}-kode`).value = parts[0];
            document.getElementById(`perjadin-${tipe}-urut`).value = parts[1];
            document.getElementById(`perjadin-${tipe}-lanjutan`).value = parts[2];
            document.getElementById(`perjadin-${tipe}-tahun`).value = parts[3];
            updateLivePreviewNomor(`perjadin-${tipe}`);
        } else {
            document.getElementById(`perjadin-${tipe}-asal`).value = 'Eksternal';
            toggleFormAsal(tipe);
            document.getElementById(`perjadin-${tipe}-lengkap`).value = nomorLengkap;
        }
    }

    setNomorDasar('ts', surat['Nomor TS'] || surat['Nomor TS Lengkap']);
    setNomorDasar('spt', surat['Nomor SPT'] || surat['Nomor SPT Lengkap']);

    // 3. Jahit Kembali Data Pelaksana & SPPD
    arrayPelaksanaPerjadin = [];
    if (surat['Pelaksana'] && surat['Pelaksana'] !== '-') {
        const arrNama = surat['Pelaksana'].toString().split(';');
        const arrNIP = (surat['NIP'] || '').toString().split(';');
        const arrStatus = (surat['Status'] || '').toString().split(';');
        const arrSPPD = (surat['Nomor SPPD'] || '').toString().split(';');
        
        for (let i = 0; i < arrNama.length; i++) {
            arrayPelaksanaPerjadin.push({
                nama: arrNama[i].trim(),
                nip: (arrNIP[i] || '').trim(),
                status: (arrStatus[i] || '').trim(),
                sppd: (arrSPPD[i] || '').trim()
            });
        }
    }
    renderDaftarPelaksana();

    // 4. Muat URL File Lama & Reset Tampilan Toggle
    const filesToLoad = [
        { id: 'ts', url: surat['URL TS'] },
        { id: 'spt', url: surat['URL SPT'] },
        { id: 'sppd', url: surat['URL SPPD'] }
    ];

    filesToLoad.forEach(f => {
        // Kembalikan saklar ke mode 'upload' secara default
        const radioUpload = document.querySelector(`input[name="method-perjadin-${f.id}"][value="upload"]`);
        if (radioUpload) radioUpload.checked = true;
        switchFileMethod(`perjadin-${f.id}`, 'upload');
        
        // Isi kedua input sekaligus (hidden untuk mode upload, text untuk mode tempel URL)
        document.getElementById(`perjadin-${f.id}-file-url`).value = f.url || '';
        document.getElementById(`perjadin-${f.id}-url`).value = f.url || '';
        
        // Sesuaikan teks status unggahan
        const status = document.getElementById(`status-upload-perjadin-${f.id}`);
        const btn = document.getElementById(`btn-upload-perjadin-${f.id}`);
        if (f.url) {
            status.innerHTML = '<span style="color: #16a34a; font-style: italic;"><i class="fa-solid fa-link"></i> File sebelumnya tersimpan. (Abaikan jika tidak diubah)</span>';
            btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Ganti File';
        } else {
            status.innerHTML = '<span style="color: #64748b; font-style: italic;">Belum ada file. Cari/pilih lalu klik Unggah.</span>';
            btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Unggah';
        }
    });

    setUploadStatus('ts', surat['URL TS']);
    setUploadStatus('spt', surat['URL SPT']);
    setUploadStatus('sppd', surat['URL SPPD']);

    cardForm.scrollIntoView({ behavior: 'smooth' });
}

// Logika Smart Pagination Builder
function renderKontrolPagination(modul, totalHalaman, halamanAktif) {
    const pagBar = document.getElementById(`${modul}-pagination`);
    if (!pagBar) return;

    if (totalHalaman <= 1) {
        pagBar.innerHTML = ''; // Sembunyikan bar jika data muat dalam 1 halaman
        return;
    }

    let htm = `<button class="btn-page" ${halamanAktif === 1 ? 'disabled' : ''} onclick="pindahKeHalaman('${modul}', ${halamanAktif - 1})">Sebelumnya</button>`;
    
    for (let i = 1; i <= totalHalaman; i++) {
        htm += `<button class="btn-page ${i === halamanAktif ? 'active' : ''}" onclick="pindahKeHalaman('${modul}', ${i})">${i}</button>`;
    }
    
    htm += `<button class="btn-page" ${halamanAktif === totalHalaman ? 'disabled' : ''} onclick="pindahKeHalaman('${modul}', ${halamanAktif + 1})">Selanjutnya</button>`;
    pagBar.innerHTML = htm;
}

function pindahKeHalaman(modul, targetHal) {
    filterState[modul].page = targetHal;
    prosesDanRenderTabel(modul);
}

// ==========================================
// LOGIKA MODAL PRATINJAU BERKAS (IFRAME & FALLBACK)
// ==========================================
function bukaPreviewModal(url) {
    const modal = document.getElementById('modalPreview');
    const body = document.getElementById('previewModalBody');
    if (!modal || !body) return;

    // 1. Bersihkan sisa konten terdahulu dan munculkan overlay modal
    body.innerHTML = '';
    modal.style.display = 'flex';

    // 2. Deteksi apakah URL merupakan sebuah folder Google Drive
    // Ciri folder: Mengandung teks '/folders/' atau tautan open non-file
    const apakahFolderDrive = url.includes('drive.google.com/drive/folders') || 
                              (url.includes('drive.google.com/open?id=') && !url.includes('file/d/'));

    if (apakahFolderDrive) {
        // TAMPILKAN PEMBERITAHUAN ALTERNATIF (PILIHAN USER)
        body.innerHTML = `
            <div class="preview-fallback">
                <div class="fallback-icon"><i class="fa-solid fa-folder-open"></i></div>
                <h4 class="fallback-title">Berkas Tidak Dapat Ditampilkan Langsung</h4>
                <p class="fallback-text">Tautan ini berupa direktori/folder. Silakan buka folder pada tab terpisah.</p>
                <a href="${url}" target="_blank" class="btn-external-link">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> Buka di Tab Terpisah
                </a>
            </div>
        `;
    } else {
        // OPTIMASI: Jika berupa file Drive biasa, ubah format ke /preview agar bisa masuk iframe
        let urlSistemEmbed = url;
        if (url.includes('drive.google.com')) {
            if (url.includes('/view')) {
                urlSistemEmbed = url.replace('/view', '/preview');
            } else if (url.includes('/edit')) {
                urlSistemEmbed = url.replace('/edit', '/preview');
            }
        }

        // TAMPILKAN BERKAS DI DALAM IFRAME SECARA UTUH
        body.innerHTML = `
            <iframe src="${urlSistemEmbed}" class="preview-iframe" allow="autoplay"></iframe>
        `;
    }
}

function tutupPreviewModal() {
    const modal = document.getElementById('modalPreview');
    const body = document.getElementById('previewModalBody');
    
    if (modal) modal.style.display = 'none';
    
    // PENTING: Bersihkan iframe saat modal ditutup agar proses streaming/load data 
    // di balik layar langsung berhenti total dan menghemat memori HP pengguna.
    if (body) body.innerHTML = ''; 
}

// ==========================================
// MODAL PILIHAN PRATINJAU FILE PERJADIN
// ==========================================
function bukaPilihanFilePerjadin(urlTS, urlSPT, urlSPPD) {
    let htmlButtons = '';
    
    // Rangkai tombol jika URL file-nya tersedia
    if (urlTS && urlTS !== 'undefined') {
        htmlButtons += `<button class="btn-primary" style="margin-bottom: 12px; background-color: #0284c7; padding: 14px;" onclick="Swal.close(); bukaPreviewModal('${urlTS}')"><i class="fa-solid fa-file-pdf"></i> Lihat Telaahan Staf (TS)</button>`;
    }
    if (urlSPT && urlSPT !== 'undefined') {
        htmlButtons += `<button class="btn-primary" style="margin-bottom: 12px; background-color: #0d9488; padding: 14px;" onclick="Swal.close(); bukaPreviewModal('${urlSPT}')"><i class="fa-solid fa-file-pdf"></i> Lihat Surat Perintah Tugas (SPT)</button>`;
    }
    if (urlSPPD && urlSPPD !== 'undefined') {
        htmlButtons += `<button class="btn-primary" style="background-color: #d97706; padding: 14px;" onclick="Swal.close(); bukaPreviewModal('${urlSPPD}')"><i class="fa-solid fa-users-viewfinder"></i> Lihat SPPD Gabungan</button>`;
    }

    if (htmlButtons === '') {
        TampilkanToast('info', 'Tidak ada satupun berkas yang diunggah untuk Perjadin ini.');
        return;
    }

    // Tampilkan menggunakan antarmuka SweetAlert2 yang seamless
    Swal.fire({
        title: 'Pilih Dokumen Pratinjau',
        html: `<div style="display: flex; flex-direction: column; gap: 5px; margin-top: 20px;">${htmlButtons}</div>`,
        showConfirmButton: false,
        showCloseButton: true,
        width: '400px',
    });
}

// ==========================================
// LOGIKA HAPUS DATA SURAT (2-STEP VERIFICATION)
// ==========================================
function hapusSurat(modul, id) {
    // LANGKAH 1: Konfirmasi Penghapusan Biasa
    Swal.fire({
        title: 'Apakah Anda yakin?',
        text: "Data surat dan file lampiran di Drive akan dihapus secara permanen!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal',
    }).then((result) => {
        
        // LANGKAH 2: Konfirmasi Kode Angka Dinamis jika Langkah 1 disetujui
        if (result.isConfirmed) {
            // Generate 4 digit angka acak dari sistem (antara 1000 sampai 9999)
            const kodeKonfirmasiSistem = Math.floor(1000 + Math.random() * 9000).toString();

            Swal.fire({
                title: 'Verifikasi Keamanan',
                html: `Masukkan 4 digit kode berikut untuk mengeksekusi penghapusan:<br><br>
                       <b style="font-size: 2.2rem; color: #dc2626; letter-spacing: 6px; font-family: monospace;">${kodeKonfirmasiSistem}</b>`,
                input: 'text',
                inputAttributes: {
                    maxlength: 4,
                    autofocus: 'true',
                    style: 'text-align: center; font-size: 1.6rem; font-weight: bold; letter-spacing: 6px; width: 160px; margin: 15px auto 0; border-radius: 8px;'
                },
                showCancelButton: true,
                confirmButtonText: 'Konfirmasi Hapus',
                confirmButtonColor: '#dc2626',
                cancelButtonText: 'Batal',
                // Validasi ketikan pengguna sebelum submit berjalan
                preConfirm: (inputUser) => {
                    if (inputUser !== kodeKonfirmasiSistem) {
                        Swal.showValidationMessage('Kode verifikasi salah! Silakan periksa kembali.');
                    }
                    return inputUser === kodeKonfirmasiSistem;
                }
            }).then(async (validationResult) => {
                
                // LANGKAH 3: Jalankan eksekusi ke server jika kode terverifikasi benar
                if (validationResult.isConfirmed) {
                    
                    // Tampilkan Spinner Loading Hapus
                    Swal.fire({
                        title: 'Menghapus Berkas...',
                        text: 'Sedang membuang data dari Spreadsheet dan merapikan folder Drive.',
                        allowOutsideClick: false,
                        didOpen: () => { Swal.showLoading(); }
                    });

                    try {
                        const response = await fetch(API_URL, {
                            method: 'POST',
                            mode: 'cors',
                            body: JSON.stringify({
                                action: 'deleteSurat',
                                modul: modul,
                                id: id,
                                username: userMasuk ? userMasuk.username : '',
                                role: userMasuk ? userMasuk.role : ''
                            })
                        });

                        const res = await response.json();

                        if (res.status === 'success') {
                            TampilkanAlert('success', 'Terhapus!', res.data.message);
                            
                            // Segarkan semua komponen visual data
                            if (typeof loadDashboardData === 'function') loadDashboardData();
                            
                            // GANTI DUA BARIS LAMA MENJADI INI:
                            fetchDataFromServer(modul);
                        } else {
                            TampilkanAlert('error', 'Gagal!', res.message);
                        }
                    } catch (error) {
                        console.error('Error saat menghapus surat:', error);
                        TampilkanToast('error', 'Gagal terhubung ke server Google.');
                    }
                }
            });
        }
    });
}

// ==========================================
// MENAMPILKAN DATA KE FORM UTK EDIT (SURAT MASUK)
// ==========================================
function bukaEditMasuk(surat) {
    // 1. Pastikan form terbuka
    const cardForm = document.getElementById('card-form-masuk');
    if (cardForm.classList.contains('collapsible-collapsed')) {
        toggleAkordion('masuk');
    }
    
    // 2. Ubah teks judul formulir & tombol
    document.getElementById('title-form-masuk').innerText = 'Ubah Data Surat Masuk';
    document.getElementById('btn-submit-masuk').innerText = 'Perbarui Data';
    
    // 3. Masukkan data dari tabel ke dalam input form
    document.getElementById('masuk-id').value = surat.ID;
    document.getElementById('masuk-tgl').value = surat['Tanggal Surat'] ? surat['Tanggal Surat'].split('T')[0] : '';
    document.getElementById('masuk-jenis').value = surat['Jenis Surat'] || '';
    document.getElementById('masuk-nomor').value = surat['Nomor Surat'] || '';
    document.getElementById('masuk-asal').value = surat['Asal/Pengirim'] || '';
    document.getElementById('masuk-perihal').value = surat['Perihal/Deskripsi'] || '';
    document.getElementById('masuk-keterangan').value = surat['Keterangan'] || '';
    
    // Default set ke metode tempel URL jika ingin mengedit link tautan lama
    if (surat['URL File']) {
        document.querySelector('input[name="method-masuk"][value="url"]').checked = true;
        switchFileMethod('masuk', 'url');
        document.getElementById('masuk-url').value = surat['URL File'];
    }
    
    // Geser layar secara halus ke posisi form paling atas agar ramah untuk pengguna HP
    cardForm.scrollIntoView({ behavior: 'smooth' });
}

// ==========================================
// MENAMPILKAN DATA KE FORM UTK EDIT (SURAT KELUAR)
// ==========================================
function bukaEditKeluar(surat) {
    const cardForm = document.getElementById('card-form-keluar');
    if (cardForm.classList.contains('collapsible-collapsed')) {
        toggleAkordion('keluar');
    }
    
    document.getElementById('title-form-keluar').innerText = 'Ubah Data Surat Keluar';
    document.getElementById('btn-submit-keluar').innerText = 'Perbarui Data';
    
    document.getElementById('keluar-id').value = surat.ID;
    document.getElementById('keluar-tgl').value = surat['Tanggal Surat'] ? surat['Tanggal Surat'].split('T')[0] : '';
    document.getElementById('keluar-jenis').value = surat['Jenis Surat'] || '';
    document.getElementById('keluar-kode').value = surat['Kode Surat'] || '';
    document.getElementById('keluar-urut').value = surat['Nomor Urut'] || '';
    document.getElementById('keluar-lanjutan').value = surat['Kode Lanjutan'] || 'KEC.LPHG-BLG';
    document.getElementById('keluar-tahun').value = surat['Tahun'] || '2026';
    document.getElementById('keluar-tujuan').value = surat['Tujuan/Penerima'] || '';
    document.getElementById('keluar-perihal').value = surat['Perihal/Deskripsi'] || '';
    document.getElementById('keluar-keterangan').value = surat['Keterangan'] || '';
    
    if (surat['URL File']) {
        document.querySelector('input[name="method-keluar"][value="url"]').checked = true;
        switchFileMethod('keluar', 'url');
        document.getElementById('keluar-url').value = surat['URL File'];
    }
    
    // Update live preview kotak nomor lengkap
    updateLivePreviewNomor('keluar');
    
    cardForm.scrollIntoView({ behavior: 'smooth' });
}

// ==========================================
// MENAMPILKAN DATA KE FORM UTK EDIT (SURAT KEPUTUSAN)
// ==========================================
function bukaEditKeputusan(surat) {
    const cardForm = document.getElementById('card-form-keputusan');
    if (cardForm.classList.contains('collapsible-collapsed')) {
        toggleAkordion('keputusan');
    }
    
    document.getElementById('title-form-keputusan').innerText = 'Ubah Data Surat Keputusan';
    document.getElementById('btn-submit-keputusan').innerText = 'Perbarui Data';
    
    document.getElementById('keputusan-id').value = surat.ID;
    document.getElementById('keputusan-tgl').value = surat['Tanggal Surat'] ? surat['Tanggal Surat'].split('T')[0] : '';
    document.getElementById('keputusan-jenis').value = surat['Jenis Surat'] || 'Surat Keputusan';
    document.getElementById('keputusan-kode').value = surat['Kode Surat'] || '';
    document.getElementById('keputusan-urut').value = surat['Nomor Urut'] || '';
    document.getElementById('keputusan-lanjutan').value = surat['Kode Lanjutan'] || 'KEC.LPHG-BLG';
    document.getElementById('keputusan-tahun').value = surat['Tahun'] || new Date().getFullYear();
    document.getElementById('keputusan-tujuan').value = surat['Tujuan/Penerima'] || '';
    document.getElementById('keputusan-perihal').value = surat['Perihal/Deskripsi'] || '';
    document.getElementById('keputusan-keterangan').value = surat['Keterangan'] || '';
    
    // Kembalikan saklar file sesuai kondisi data
    if (surat['URL File']) {
        document.querySelector('input[name="method-keputusan"][value="url"]').checked = true;
        switchFileMethod('keputusan', 'url');
        document.getElementById('keputusan-url').value = surat['URL File'];
    } else {
        document.querySelector('input[name="method-keputusan"][value="upload"]').checked = true;
        switchFileMethod('keputusan', 'upload');
    }
    
    // Update live preview kotak nomor lengkap SK
    updateLivePreviewNomor('keputusan');
    
    cardForm.scrollIntoView({ behavior: 'smooth' });
}

// ==========================================
// STATE MANAJEMEN DATA LOKAL (PAGINATION & SEARCH)
// ==========================================
let masterDataSurat = { masuk: [], keluar: [], keputusan: [], perjadin: [] };
let filterState = {
    masuk: { search: '', limit: 5, page: 1 },
    keluar: { search: '', limit: 5, page: 1 },
    keputusan: { search: '', limit: 5, page: 1 },
    perjadin: { search: '', limit: 5, page: 1 }
};
let modulUnduhAktif = ''; 
let isDashboardLoaded = false; // <--- TAMBAHKAN BARIS INI



async function fetchDataFromServer(modul) {
    const tableContainer = document.getElementById(`tabel-surat-${modul}`);
    if (tableContainer) {
        tableContainer.innerHTML = `<div class="spinner-container"><div class="spinner-large"></div><p class="loading-text">Mengambil data dari server...</p></div>`;
    }

    // --- PASTIKAN BAGIAN INI DITAMBAHKAN RUTE KEPUTUSAN ---
    let actionParam = '';
    if (modul === 'masuk') {
        actionParam = 'readSuratMasuk';
    } else if (modul === 'keluar') {
        actionParam = 'readSuratKeluar';
    } else if (modul === 'keputusan') {
        actionParam = 'readSuratKeputusan'; // Tambahan jalur untuk SK
    } else if (modul === 'perjadin') {
        actionParam = 'readSuratPerjadin'; // <-- TAMBAHAN JALUR PERJADIN
    }
    // ------------------------------------------------------

    try {
        const response = await fetch(`${API_URL}?action=${actionParam}`);
        const result = await response.json();
        
        if (result.status === 'success') {
            masterDataSurat[modul] = result.data;
            prosesDanRenderTabel(modul); // Memanggil perender tabel
        } else {
            if (tableContainer) tableContainer.innerHTML = `<p class="message-box">Gagal memuat data: ${result.message}</p>`;
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        if (tableContainer) tableContainer.innerHTML = `<p class="message-box">Gagal terhubung ke server. Periksa koneksi internet Anda.</p>`;
    }
}

// Fungsi Trigger Tombol Refresh Manual di Ujung Kanan
function refreshDataManual(modul) {
    TampilkanToast('info', 'Menyegarkan data dari database...');
    fetchDataFromServer(modul);
}

// Fungsi Trigger Tombol Refresh Manual khusus untuk Dashboard
function refreshDashboardManual() {
    TampilkanToast('info', 'Menyegarkan data ringkasan Dashboard...');
    loadDashboardData();
}

// ==========================================
// LOGIKA FILTER, LIVE SEARCH & SMART PAGINATION
// ==========================================
function inputPencarianLokal(modul) {
    filterState[modul].search = document.getElementById(`${modul}-search`).value.toLowerCase();
    filterState[modul].page = 1; // Kembali ke halaman 1 saat mengetik kata kunci
    prosesDanRenderTabel(modul);
}

function gantiLimitBaris(modul) {
    const valLimit = document.getElementById(`${modul}-limit`).value;
    filterState[modul].limit = valLimit === 'all' ? 'all' : parseInt(valLimit);
    filterState[modul].page = 1;
    prosesDanRenderTabel(modul);
}

// UBAH FUNGSI INI DI script.js
function prosesDanRenderTabel(modul) {
    const state = filterState[modul];
    const dataAsli = masterDataSurat[modul];
    
    // 1. EVALUASI FILTER LIVE PENCARIAN (Pencarian Otomatis)
    const dataTerfilter = dataAsli.filter(surat => {
        // Ambil jenis & perihal dengan fallback ke nama kolom baru
        const jenis = (surat['Jenis Surat'] || surat['Jenis'] || '').toLowerCase();
        const perihal = (surat['Perihal/Deskripsi'] || surat['Maksud'] || '').toLowerCase();
        
        if (modul === 'masuk') {
            const asal = (surat['Asal/Pengirim'] || '').toLowerCase();
            return jenis.includes(state.search) || perihal.includes(state.search) || asal.includes(state.search);
        } else if (modul === 'keluar') {
            const tujuan = (surat['Tujuan/Penerima'] || '').toLowerCase();
            return jenis.includes(state.search) || perihal.includes(state.search) || tujuan.includes(state.search);
        } else if (modul === 'keputusan') {
            const tujuan = (surat['Tujuan/Penerima'] || '').toLowerCase();
            return jenis.includes(state.search) || perihal.includes(state.search) || tujuan.includes(state.search);
        } else if (modul === 'perjadin') {
            // --- PERUBAHAN DI SINI ---
            // Tangkap data kolom Tujuan (Daerah) dan Pelaksana (Nama Pegawai)
            const tujuan = (surat['Tujuan'] || '').toLowerCase();
            const pelaksana = (surat['Pelaksana'] || '').toLowerCase();
            
            // Pencarian ditekankan pada Jenis Perjadin, Daerah Tujuan, dan Nama Pegawai
            return jenis.includes(state.search) || tujuan.includes(state.search) || pelaksana.includes(state.search);
        }
        return true;
    });

    // ==========================================
    // PERBAIKAN: URUTKAN BERDASARKAN TANGGAL, LALU NOMOR URUT
    // ==========================================
    dataTerfilter.sort((a, b) => {
        let stringTanggalA = modul === 'perjadin' ? a['Tanggal Berangkat'] : a['Tanggal Surat'];
        let stringTanggalB = modul === 'perjadin' ? b['Tanggal Berangkat'] : b['Tanggal Surat'];
        
        let waktuA = stringTanggalA ? new Date(stringTanggalA).getTime() : 0;
        let waktuB = stringTanggalB ? new Date(stringTanggalB).getTime() : 0;
        
        // 1. Bandingkan Tanggal (Terbaru di atas / Descending)
        if (waktuB !== waktuA) {
            return waktuB - waktuA; 
        } 
        // 2. Jika Tanggal SAMA, bandingkan Nomor Urut (Terbesar di atas)
        else {
            let noA = parseInt(a['Nomor Urut']) || 0;
            let noB = parseInt(b['Nomor Urut']) || 0;
            return noB - noA; 
        }
    });

   // 2. HITUNG PAGINATION DATA
    const totalData = dataTerfilter.length;
    const limit = state.limit;
    const totalHalaman = limit === 'all' ? 1 : Math.ceil(totalData / limit);
    
    if (state.page > totalHalaman) state.page = totalHalaman || 1;
    
    const indeksMulai = limit === 'all' ? 0 : (state.page - 1) * limit;
    const indeksSelesai = limit === 'all' ? totalData : indeksMulai + limit;
    
    const dataHalamanAktif = dataTerfilter.slice(indeksMulai, indeksSelesai);

    // 3. RENDER ISI KONTEN BARIS TABEL
    if (modul === 'masuk') {
        renderBarisSuratMasuk(dataHalamanAktif);
    } else if (modul === 'keluar') {
        renderBarisSuratKeluar(dataHalamanAktif);
    } else if (modul === 'keputusan') {
        renderBarisSuratKeputusan(dataHalamanAktif);
    } else if (modul === 'perjadin') {
        renderBarisSuratPerjadin(dataHalamanAktif); // <-- INI YANG MEMBUAT SPINNER BERHENTI
    }
    
    // 4. RENDER TOMBOL BAR PAGINATION
    renderKontrolPagination(modul, totalHalaman, state.page);
}

function bukaModalUnduh(modul) {
    modulUnduhAktif = modul;
    document.getElementById('unduh-tgl-mulai').value = '';
    document.getElementById('unduh-tgl-selesai').value = '';
    document.getElementById('modalUnduh').style.display = 'flex';
}

function tutupModalUnduh() {
    document.getElementById('modalUnduh').style.display = 'none';
}

// ==========================================
// EKSPOR REKAPITULASI KE PDF (LANDSCAPE A4)
// ==========================================
function prosesEksporPDF() {
    const tglMulai = document.getElementById('unduh-tgl-mulai').value;
    const tglSelesai = document.getElementById('unduh-tgl-selesai').value;

    if (!tglMulai || !tglSelesai) {
        TampilkanToast('warning', 'Silakan isi kedua rentang tanggal terbit!');
        return;
    }

    // --- HELPER: FORMAT TANGGAL KE DD-MM-YYYY ---
    const formatTanggalID = (tgl) => {
        if (!tgl || tgl === '-') return '-';
        const parts = tgl.split('T')[0].split('-'); 
        // parts[0]=yyyy, parts[1]=mm, parts[2]=dd
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`; 
        }
        return tgl;
    };

    const tglMulaiIndo = formatTanggalID(tglMulai);
    const tglSelesaiIndo = formatTanggalID(tglSelesai);
    // --------------------------------------------

    const dataAsli = masterDataSurat[modulUnduhAktif];
    
    // Filter data berdasarkan rentang Tanggal Surat terbit (atau Berangkat untuk Perjadin)
    const dataTerfilter = dataAsli.filter(s => {
        let tglField = modulUnduhAktif === 'perjadin' ? s['Tanggal Berangkat'] : s['Tanggal Surat'];
        const tglObj = tglField ? tglField.split('T')[0] : '';
        return tglObj >= tglMulai && tglObj <= tglSelesai;
    });

    // ==========================================
    // URUTAN KHUSUS PDF: TERLAMA DI ATAS (KRONOLOGIS)
    // ==========================================
    dataTerfilter.sort((a, b) => {
        let tglFieldA = modulUnduhAktif === 'perjadin' ? a['Tanggal Berangkat'] : a['Tanggal Surat'];
        let tglFieldB = modulUnduhAktif === 'perjadin' ? b['Tanggal Berangkat'] : b['Tanggal Surat'];
        
        let waktuA = tglFieldA ? new Date(tglFieldA).getTime() : 0;
        let waktuB = tglFieldB ? new Date(tglFieldB).getTime() : 0;
        
        // 1. Bandingkan Tanggal (Terlama di atas / Ascending)
        if (waktuA !== waktuB) {
            return waktuA - waktuB; 
        } 
        // 2. Jika Tanggal SAMA, bandingkan Nomor Urut (Terkecil di atas)
        else {
            let noA = parseInt(a['Nomor Urut']) || 0;
            let noB = parseInt(b['Nomor Urut']) || 0;
            return noA - noB; 
        }
    });

    if (dataTerfilter.length === 0) {
        TampilkanAlert('info', 'Data Kosong', 'Tidak ditemukan arsip dokumen pada rentang tanggal tersebut.');
        return;
    }

    // Inisialisasi jsPDF format Landscape A4
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape', 'mm', 'a4');
    
    let judul = "";
    let columns = [];
    let rows = [];

    // Mapping Data Berdasarkan Modul (Menerapkan formatTanggalID)
    if (modulUnduhAktif === 'masuk') {
        judul = "REKAPITULASI SURAT MASUK";
        columns = ["No", "Tanggal & Nomor Surat", "Jenis & Perihal", "Asal/Pengirim", "Keterangan", "URL File"];
        rows = dataTerfilter.map((s, index) => [
            index + 1,
            `Tgl: ${formatTanggalID(s['Tanggal Surat'])}\nNo: ${s['Nomor Surat'] || '-'}`,
            `Jenis: ${s['Jenis Surat'] || '-'}\nPerihal: ${s['Perihal/Deskripsi'] || '-'}`,
            s['Asal/Pengirim'] || '-',
            s['Keterangan'] || '-',
            s['URL File'] || '-'
        ]);
    } else if (modulUnduhAktif === 'keluar') {
        judul = "REKAPITULASI SURAT KELUAR";
        columns = ["No", "Tanggal & Nomor Surat", "Jenis & Perihal", "Tujuan/Penerima", "Keterangan", "URL File"];
        rows = dataTerfilter.map((s, index) => [
            index + 1,
            `Tgl: ${formatTanggalID(s['Tanggal Surat'])}\nNo: ${s['Nomor Surat Lengkap'] || '-'}`,
            `Jenis: ${s['Jenis Surat'] || '-'}\nPerihal: ${s['Perihal/Deskripsi'] || '-'}`,
            s['Tujuan/Penerima'] || '-',
            s['Keterangan'] || '-',
            s['URL File'] || '-'
        ]);
    } else if (modulUnduhAktif === 'keputusan') {
        judul = "REKAPITULASI SURAT KEPUTUSAN";
        columns = ["No", "Tanggal & Nomor Surat", "Jenis & Perihal", "Penerima SK", "Keterangan", "URL File"];
        rows = dataTerfilter.map((s, index) => [
            index + 1,
            `Tgl: ${formatTanggalID(s['Tanggal Surat'])}\nNo: ${s['Nomor Surat Lengkap'] || '-'}`,
            `Jenis: ${s['Jenis Surat'] || '-'}\nPerihal: ${s['Perihal/Deskripsi'] || '-'}`,
            s['Tujuan/Penerima'] || '-', 
            s['Keterangan'] || '-',
            s['URL File'] || '-'
        ]);
    } else if (modulUnduhAktif === 'perjadin') {
        judul = "REKAPITULASI SURAT-MENYURAT PERJALANAN DINAS";
        columns = ["No", "Jenis Perjadin", "Maksud & Tujuan", "Nomor TS & SPT", "Nomor SPPD & Pelaksana", "URL TS", "URL SPT", "URL SPPD"];
        rows = dataTerfilter.map((s, index) => {
            // Merangkai Bullet Points untuk Pelaksana
            let pelaksanaStr = "-";
            if (s['Pelaksana'] && s['Pelaksana'] !== '-') {
                const arrNama = s['Pelaksana'].toString().split(';');
                const arrNIP = (s['NIP'] || '').toString().split(';');
                const arrStatus = (s['Status'] || '').toString().split(';');
                const arrSPPD = (s['Nomor SPPD'] || '').toString().split(';');
                
                let tempList = arrNama.map((nama, i) => `• ${(arrSPPD[i]||'-').trim()} / ${nama.trim()} / ${(arrNIP[i]||'-').trim()} / ${(arrStatus[i]||'-').trim()}`);
                pelaksanaStr = tempList.join('\n');
            }

            return [
                index + 1,
                `${s['Jenis'] || '-'}\n(${formatTanggalID(s['Tanggal Berangkat'])} s.d.\n${formatTanggalID(s['Tanggal Kembali'])})`,
                `Maksud:\n${s['Maksud'] || '-'}\n\nTujuan:\n${s['Tujuan'] || '-'}`,
                `No TS: ${s['Nomor TS'] || '-'}\nNo SPT: ${s['Nomor SPT'] || '-'}`,
                pelaksanaStr,
                s['URL TS'] || '-',
                s['URL SPT'] || '-',
                s['URL SPPD'] || '-'
            ];
        });
    }

    // Pengaturan dinamis lebar kolom berdasarkan modul
    let gayaKolomDinamic = {
        0: { halign: 'center', cellWidth: 10 } // Kolom No selalu 10mm dan rata tengah
    };

    if (modulUnduhAktif === 'perjadin') {
        gayaKolomDinamic[5] = { cellWidth: 20 }; // URL TS
        gayaKolomDinamic[6] = { cellWidth: 20 }; // URL SPT
        gayaKolomDinamic[7] = { cellWidth: 20 }; // URL SPPD
        gayaKolomDinamic[4] = { cellWidth: 80 }; // Daftar Pelaksana
    } else {
        gayaKolomDinamic[5] = { cellWidth: 35 }; // URL pada surat biasa
    }

    // Eksekusi AutoTable untuk menggambar tabel di PDF
    doc.autoTable({
        head: [columns],
        body: rows,
        startY: 35, // Jarak mulai tabel dari atas
        theme: 'grid',
        styles: {
            font: 'helvetica',
            fontSize: 8,
            cellPadding: 3,
            valign: 'top', // <-- UBAH INI: Menjadikan seluruh isi tabel rata atas
            overflow: 'linebreak'
        },
        headStyles: {
            fillColor: [26, 54, 93], // Warna Header Navy khas SANDI
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle' // <-- TAMBAHKAN INI: Memastikan teks header tetap rata tengah secara vertikal
        },
        columnStyles: gayaKolomDinamic,
                
        // Hook didDrawPage digunakan untuk mencetak Kop dan Footer berulang di setiap halaman
        didDrawPage: function (data) {
            const pageWidth = doc.internal.pageSize.width;
            const pageHeight = doc.internal.pageSize.height;
            let y = 15;
            
            // 1. Judul Tengah
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text(judul, pageWidth / 2, y, { align: "center" });
            
            // 2. Subjudul Periode (Menggunakan Tanggal Indonesia)
            y += 6;
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`Periode: ${tglMulaiIndo} s.d. ${tglSelesaiIndo}`, pageWidth / 2, y, { align: "center" });

            // 3. Info Unit Kerja (Kiri Atas Tabel)
            y += 8;
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text("Unit Kerja: Kecamatan Lampihong", 14, y);

            // 4. Footer Kiri & Kanan
            doc.setFontSize(8);
            doc.setFont("helvetica", "italic");
            doc.text("Diunduh dari SANDI - Sistem Administrasi Digital", 14, pageHeight - 10);
            doc.text("Halaman " + doc.internal.getNumberOfPages(), pageWidth - 14, pageHeight - 10, { align: "right" });
        }
    });

    // Generate dan Simpan File PDF
    const tglSkg = new Date().toLocaleDateString('sv-SE');
    doc.save(`Rekap_${modulUnduhAktif.toUpperCase()}_${tglSkg}.pdf`);

    tutupModalUnduh();
    TampilkanToast('success', 'File rekap PDF berhasil diunduh!');
}

// ==========================================
// ASISTEN PEMINDAI NOMOR KOSONG / TERLEWAT
// ==========================================
async function jalankanDetektorNomor(modul, subModul = null) {
    let tahun = new Date().getFullYear().toString();
    let targetElementId = '';

    // Tentukan tahun acuan dan target input tempat angka akan disisipkan
    if (modul === 'perjadin') {
        if (subModul === 'ts' || subModul === 'spt') {
            tahun = document.getElementById(`perjadin-${subModul}-tahun`).value || tahun;
            targetElementId = `perjadin-${subModul}-urut`;
        } else if (subModul === 'sppd') {
            const tglBerangkat = document.getElementById('perjadin-tgl-berangkat').value;
            if (tglBerangkat) {
                tahun = new Date(tglBerangkat).getFullYear().toString();
            }
            targetElementId = 'input-pegawai-sppd'; // Targetkan ke input pegawai
        }
    } else {
        tahun = document.getElementById(`${modul}-tahun`).value || tahun;
        targetElementId = `${modul}-urut`;
    }

    TampilkanToast('info', `Memindai celah nomor ${subModul ? subModul.toUpperCase() : modul} di database...`);

    try {
        let urlFetch = `${API_URL}?action=cekNomorKosong&modul=${modul}&tahun=${tahun}`;
        if (subModul) urlFetch += `&subModul=${subModul}`;

        const response = await fetch(urlFetch);
        const result = await response.json();

        if (result.status === 'success') {
            const data = result.data;
            let htmlPesan = `<div style="text-align: left; line-height: 1.6;">
                <p>Tahun Arsip: <strong>${tahun}</strong></p>
                <p style="margin-top: 10px;">Nomor Tersedia Berikutnya: <br><span style="font-size: 2rem; font-weight: bold; color: #2563eb;">${data.next}</span></p>`;

            if (data.missing.length > 0) {
                htmlPesan += `<p style="margin-top: 20px; color: #dc2626; font-weight: 600;">⚠️ Terdapat Nomor yang Terlewat:</p>
                              <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; max-height: 120px; overflow-y: auto; font-family: monospace; font-size: 1.1rem; letter-spacing: 2px;">
                                ${data.missing.join(', ')}
                              </div>
                              <p style="font-size: 0.85rem; color: #64748b; margin-top: 8px;">*Anda dapat menyalin salah satu angka di atas jika ingin menyisipkan dokumen mundur.</p>`;
            } else {
                htmlPesan += `<p style="margin-top: 20px; color: #059669; font-weight: 500;"><i class="fa-solid fa-circle-check"></i> Luar biasa! Seluruh urutan nomor sudah terisi rapat, tidak ada yang bolong.</p>`;
            }
            htmlPesan += `</div>`;

            let titleAsisten = 'Asisten Penomoran';
            if (subModul) titleAsisten += ` ${subModul.toUpperCase()}`;

            Swal.fire({
                title: titleAsisten,
                html: htmlPesan,
                icon: 'info',
                confirmButtonText: `Gunakan Nomor ${data.next}`,
                showCancelButton: true,
                cancelButtonText: 'Tutup',
                confirmButtonColor: '#1a365d'
            }).then((res) => {
                if (res.isConfirmed) {
                    // Masukkan angka ke input target
                    document.getElementById(targetElementId).value = data.next;
                    
                    // Picu live preview nomor utuh
                    if (modul === 'perjadin' && (subModul === 'ts' || subModul === 'spt')) {
                        updateLivePreviewNomor(`perjadin-${subModul}`);
                    } else if (modul !== 'perjadin') {
                        updateLivePreviewNomor(modul);
                    }
                }
            });
        }
    } catch (error) {
        TampilkanToast('error', 'Gagal memindai database.');
    }
}

// ==========================================
// MANAJEMEN MODAL REFERENSI PEGAWAI
// ==========================================
function bukaModalPegawai() {
    const modal = document.getElementById('modalPegawai');
    if (modal) {
        document.getElementById('searchPegawaiInput').value = ''; // Bersihkan pencarian sebelumnya
        renderModalPegawai(daftarPegawai); // Render ulang semua
        modal.style.display = 'flex';
    }
}

function tutupModalPegawai() {
    const modal = document.getElementById('modalPegawai');
    if (modal) modal.style.display = 'none';
}

function renderModalPegawai(data) {
    const listContainer = document.getElementById('listPegawai');
    if (!listContainer) return;

    if (data.length === 0) {
        if (statusMemuatReferensi) {
            listContainer.innerHTML = '<li class="loading-item" style="text-align: center; padding: 25px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: #2563eb; margin-bottom: 15px;"></i><br><span style="color: #64748b;">Sedang menyinkronkan data...</span></li>';
        } else {
            listContainer.innerHTML = '<li class="loading-item" style="padding: 15px; color: #64748b; font-style: italic;">Tidak ada data pegawai. Silakan klik tombol Sinkron Referensi.</li>';
        }
        return;
    }

    listContainer.innerHTML = data.map(item => `
        <li class="kode-item" onclick="pilihPegawai('${item.nip}', '${item.nama}', '${item.status}')">
            <span class="kode-text" style="flex: 1;">
                <strong style="color: #1a365d; font-size: 0.95rem;">${item.nama}</strong> <br>
                <small style="color: #64748b;">NIP. ${item.nip} &nbsp;•&nbsp; ${item.status}</small>
            </span>
        </li>
    `).join('');
}

function filterPegawai() {
    const keyword = document.getElementById('searchPegawaiInput').value.toLowerCase();
    const hasilFilter = daftarPegawai.filter(item => 
        item.nip.toLowerCase().includes(keyword) || 
        item.nama.toLowerCase().includes(keyword) ||
        item.status.toLowerCase().includes(keyword)
    );
    renderModalPegawai(hasilFilter);
}

function pilihPegawai(nip, nama, status) {
    document.getElementById('input-pegawai-nip').value = nip;
    document.getElementById('input-pegawai-nama').value = nama;
    document.getElementById('input-pegawai-status').value = status;
    
    // Pindahkan fokus ke input No. Urut SPPD agar pengguna bisa langsung mengetik
    document.getElementById('input-pegawai-sppd').focus();
    
    tutupModalPegawai();
}

// ==========================================
// LOGIKA MODUL PERJADIN (PERJALANAN DINAS)
// ==========================================

// 1. Perhitungan Otomatis Lama Hari (Inklusif)
function hitungLamaHariPerjadin() {
    const tglBerangkat = document.getElementById('perjadin-tgl-berangkat').value;
    const tglKembali = document.getElementById('perjadin-tgl-kembali').value;
    const outputLama = document.getElementById('perjadin-lama-hari');

    if (tglBerangkat && tglKembali) {
        const d1 = new Date(tglBerangkat);
        const d2 = new Date(tglKembali);
        const selisihWaktu = d2.getTime() - d1.getTime();
        const selisihHari = Math.ceil(selisihWaktu / (1000 * 3600 * 24));

        if (selisihHari < 0) {
            outputLama.value = "Tanggal tidak valid";
            outputLama.style.color = "#dc2626"; // Merah
        } else {
            const totalHari = selisihHari + 1; // Ditambah 1 karena perhitungan inklusif
            outputLama.value = `${totalHari} Hari`;
            outputLama.style.color = "#0f172a"; // Warna standar
        }
    } else {
        outputLama.value = "";
    }
}

// 2. Transisi Antarmuka Internal/Eksternal
function toggleFormAsal(jenis) {
    // Parameter jenis akan bernilai 'ts' atau 'spt'
    const asal = document.getElementById(`perjadin-${jenis}-asal`).value;
    const internalGroup = document.getElementById(`perjadin-${jenis}-internal-group`);
    const eksternalGroup = document.getElementById(`perjadin-${jenis}-eksternal-group`);

    if (asal === 'Internal') {
        internalGroup.style.display = ''; // Kembali ke default grid/flex
        eksternalGroup.style.display = 'none';
        
        // Kosongkan field eksternal saat beralih ke internal
        document.getElementById(`perjadin-${jenis}-lengkap`).value = '';
    } else {
        internalGroup.style.display = 'none';
        eksternalGroup.style.display = 'block';
    }
}

// 3. Manajemen Daftar Rombongan Pegawai (Array to JSON)
let arrayPelaksanaPerjadin = [];

function tambahPelaksanaPerjadin() {
    const nip = document.getElementById('input-pegawai-nip').value;
    const nama = document.getElementById('input-pegawai-nama').value;
    const status = document.getElementById('input-pegawai-status').value;
    let sppd = document.getElementById('input-pegawai-sppd').value;

    if (!nip || !nama) {
        TampilkanToast('warning', 'Pilih data pegawai dari tombol cari 🔍 terlebih dahulu.');
        return;
    }

    // Mencegah NIP ganda di dalam satu rombongan
    const isDuplicate = arrayPelaksanaPerjadin.some(p => p.nip === nip);
    if (isDuplicate) {
        TampilkanToast('warning', 'Pegawai ini sudah masuk di daftar pelaksana.');
        return;
    }

    // --- TAMBAHAN BARU: Cegah Nomor SPPD ganda di form yang sama ---
    if (sppd) {
        const sppdFormat = formatNomorUrut(sppd);
        const isSppdDuplicate = arrayPelaksanaPerjadin.some(p => p.sppd === sppdFormat);
        if (isSppdDuplicate) {
            TampilkanToast('warning', `Nomor SPPD ${sppdFormat} sudah digunakan oleh pegawai lain di form ini.`);
            return;
        }
        sppd = sppdFormat; // Rapikan penulisan sekalian
    }
    // ---------------------------------------------------------------

    arrayPelaksanaPerjadin.push({ nip, nama, status, sppd });

    // Bersihkan kotak input setelah pegawai berhasil didorong ke daftar
    document.getElementById('input-pegawai-nip').value = '';
    document.getElementById('input-pegawai-nama').value = '';
    document.getElementById('input-pegawai-status').value = '';
    document.getElementById('input-pegawai-sppd').value = '';

    renderDaftarPelaksana();
}

function hapusPelaksana(index) {
    arrayPelaksanaPerjadin.splice(index, 1);
    renderDaftarPelaksana();
}

// Fungsi untuk menarik kembali data pegawai ke form input
function editPelaksana(index) {
    // 1. Ambil data pegawai dari memori berdasarkan urutannya
    const p = arrayPelaksanaPerjadin[index];

    // 2. Kembalikan data tersebut ke kotak input
    document.getElementById('input-pegawai-nip').value = p.nip;
    document.getElementById('input-pegawai-nama').value = p.nama;
    document.getElementById('input-pegawai-status').value = p.status;
    document.getElementById('input-pegawai-sppd').value = p.sppd || '';

    // 3. Hapus data ini dari daftar sementara agar tidak terdeteksi sebagai duplikat
    arrayPelaksanaPerjadin.splice(index, 1);
    
    // 4. Perbarui tampilan daftar di bawah
    renderDaftarPelaksana();

    // 5. Arahkan kursor langsung berkedip di kotak SPPD untuk kemudahan admin
    document.getElementById('input-pegawai-sppd').focus();
}

function renderDaftarPelaksana() {
    const container = document.getElementById('daftar-pelaksana-container');
    const hiddenInput = document.getElementById('perjadin-data-pelaksana');
    
    // --- TAMBAHAN BARU: Pengurutan Otomatis Berdasarkan Nomor SPPD ---
    arrayPelaksanaPerjadin.sort((a, b) => {
        // Jika SPPD kosong, kita ubah sementara jadi 'ZZZ' agar jatuh ke urutan paling bawah
        const numA = a.sppd ? a.sppd : 'ZZZ';
        const numB = b.sppd ? b.sppd : 'ZZZ';
        // Gunakan numeric localeCompare agar angka seperti "012" dan "014" diurutkan dengan benar secara matematis
        return numA.localeCompare(numB, undefined, { numeric: true, sensitivity: 'base' });
    });
    // ------------------------------------------------------------------

    // Tanamkan data bentuk JSON utuh ke dalam tag <input> tersembunyi untuk dikirim ke GAS
    hiddenInput.value = JSON.stringify(arrayPelaksanaPerjadin);

    if (arrayPelaksanaPerjadin.length === 0) {
        container.innerHTML = '<p id="pelaksana-kosong" style="color: #64748b; font-size: 0.9rem; font-style: italic;">Belum ada pegawai yang ditambahkan.</p>';
        return;
    }

    // Gambar ulang UI daftar/kartu pegawai
    container.innerHTML = arrayPelaksanaPerjadin.map((p, index) => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            <div style="line-height: 1.4;">
                <strong style="color: #1e293b;">${p.nama}</strong> <span style="font-size: 0.75rem; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; margin-left: 5px; font-weight: 600;">${p.status}</span><br>
                <small style="color: #64748b;">NIP: ${p.nip}</small><br>
                <small style="color: #2563eb; font-weight: 600;">Nomor SPPD: ${p.sppd || '<i style="color:#94a3b8; font-weight:normal;">(Belum ada nomor)</i>'}</small>
            </div>
            <div style="display: flex; gap: 8px;">
                <button type="button" class="btn-icon-action edit" onclick="editPelaksana(${index})" title="Edit Nomor SPPD">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button type="button" class="btn-icon-action delete" onclick="hapusPelaksana(${index})" title="Hapus dari daftar">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// ==========================================
// LOGIKA UNGGAH FILE TUNGGAL (SEBELUM SIMPAN FORM)
// ==========================================

// Fungsi mereset status jika pengguna tiba-tiba mengganti file setelah berhasil unggah
function resetStatusUnggah(modul) {
    document.getElementById(`status-upload-${modul}`).innerHTML = '<span style="color: #ea580c; font-style: italic;">File diubah. Silakan klik tombol Unggah lagi.</span>';
    document.getElementById(`${modul}-file-url`).value = ''; // Kosongkan URL lama
    
    const btnUpload = document.getElementById(`btn-upload-${modul}`);
    if(btnUpload) {
        btnUpload.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Unggah';
        btnUpload.disabled = false;
    }
}

// Fungsi tombol unggah dieksekusi
async function unggahFileSatuPerSatu(modul) {
    const fileInput = document.getElementById(`${modul}-file`);
    const btnUpload = document.getElementById(`btn-upload-${modul}`);
    const statusText = document.getElementById(`status-upload-${modul}`);
    const hiddenUrl = document.getElementById(`${modul}-file-url`);

    if (!fileInput || fileInput.files.length === 0) {
        TampilkanToast('warning', 'Pilih file terlebih dahulu sebelum mengunggah.');
        return;
    }

    const file = fileInput.files[0];
    if (file.size > 1048576) { // 1 MB
        TampilkanAlert('error', 'File Kebesaran', 'Ukuran maksimal file adalah 1 MB.');
        return;
    }

    // Ubah tampilan tombol jadi Loading
    btnUpload.disabled = true;
    btnUpload.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengunggah...';
    statusText.innerHTML = '<span style="color: #2563eb;">Sedang mengirim ke Google Drive...</span>';

    try {
        const base64 = await fileToBase64(file);

        // Tembak langsung ke case 'unggahFileSaja' di GAS
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: 'unggahFileSaja', 
                file: { base64: base64, name: file.name, mimeType: file.type }, 
                modul: modul 
            })
        });
        const result = await response.json();

        if (result.status === 'success') {
            hiddenUrl.value = result.data.url; // Simpan URL dari server secara diam-diam
            statusText.innerHTML = '<span style="color: #16a34a; font-weight: 600;"><i class="fa-solid fa-check"></i> Berhasil diunggah ke Drive!</span>';
            btnUpload.innerHTML = '<i class="fa-solid fa-check-double"></i> Selesai';
        } else {
            throw new Error(result.message);
        }
    } catch (e) {
        TampilkanToast('error', 'Gagal mengunggah file. Pastikan koneksi stabil.');
        btnUpload.disabled = false;
        btnUpload.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Coba Lagi';
        statusText.innerHTML = '<span style="color: #dc2626;">Gagal terhubung ke server.</span>';
    }
}

function highlightNomorUrut(str) {
    if (!str || str === '-') return '-';
    // Memecah berdasarkan separator "/"
    const parts = str.split('/');
    if (parts.length >= 3) {
        // parts[0] = Kode, parts[1] = Nomor Urut, parts[2] = Lanjutan, dst
        // Kita bungkus bagian ke-2 (nomor urut) dengan span khusus
        return `${parts[0]}/<span class="highlight-urut">${parts[1]}</span>/${parts.slice(2).join('/')}`;
    }
    return str; // Jika format bukan x/x/x, tampilkan apa adanya
}

// ==========================================
// STATE MANAJEMEN DATA PENGATURAN LOKAL
// ==========================================
let dataPengaturan = { jenis: [], admin: [], pegawai: [] };

// ==========================================
// KONTROL AKORDION PENGATURAN
// ==========================================
function toggleAkordionPengaturan(submodul) {
    const content = document.getElementById(`content-pengaturan-${submodul}`);
    const btn = document.getElementById(`btn-toggle-${submodul}`);
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        btn.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
        // Otomatis tarik data saat akordion dibuka
        fetchPengaturanData(submodul);
    } else {
        content.style.display = 'none';
        btn.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
    }
}

// ==========================================
// TARIK DATA (READ) PENGATURAN DARI SERVER
// ==========================================
async function fetchPengaturanData(submodul) {
    const tbody = document.getElementById(`tabel-pengaturan-${submodul}`);
    if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="text-center loading-text"><i class="fa-solid fa-spinner fa-spin"></i> Mengambil data dari server...</td></tr>`;

    let actionApi = '';
    if (submodul === 'jenis') actionApi = 'readPengaturanJenis';
    else if (submodul === 'admin') actionApi = 'readPengaturanAdmin';
    else if (submodul === 'pegawai') actionApi = 'readPengaturanPegawai';

    try {
        const response = await fetch(`${API_URL}?action=${actionApi}`);
        const result = await response.json();

        if (result.status === 'success') {
            dataPengaturan[submodul] = result.data;
            renderTabelPengaturan(submodul);
        } else {
            if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="text-center loading-text" style="color:#dc2626;">Gagal memuat: ${result.message}</td></tr>`;
        }
    } catch (error) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="text-center loading-text" style="color:#dc2626;">Koneksi terputus.</td></tr>`;
    }
}

// ==========================================
// RENDER TABEL PENGATURAN
// ==========================================
function renderTabelPengaturan(submodul) {
    const tbody = document.getElementById(`tabel-pengaturan-${submodul}`);
    let dataToRender = dataPengaturan[submodul];
    let html = '';

    if (!dataToRender || dataToRender.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center loading-text">Belum ada data teregistrasi.</td></tr>`;
        return;
    }

    if (submodul === 'jenis') {
        html = dataToRender.map(jenis => `
            <tr>
                <td><span class="cell-main-text">${jenis}</span></td>
                <td class="text-center"><div class="table-icon-group">
                    <button class="btn-icon-action edit" onclick="bukaModalPengaturan('jenis', '${jenis}')"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn-icon-action delete" onclick="hapusPengaturan('jenis', '${jenis}')"><i class="fa-solid fa-trash-can"></i></button>
                </div></td>
            </tr>
        `).join('');
    } 
    else if (submodul === 'admin') {
        html = dataToRender.map(admin => `
            <tr>
                <td><span class="cell-main-text">${admin.nama}</span></td>
                <td><span class="cell-normal-text">${admin.username}</span></td>
                <td><span class="badge-jenis-surat" style="${admin.role === 'Super Admin' ? 'background:#fef3c7;color:#b45309;border-color:#fde68a;' : ''}">${admin.role}</span></td>
                <td class="text-center"><div class="table-icon-group">
                    <button class="btn-icon-action edit" onclick="bukaModalPengaturan('admin', ${JSON.stringify(admin).replace(/"/g, '&quot;')})"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn-icon-action delete" onclick="hapusPengaturan('admin', '${admin.username}')"><i class="fa-solid fa-trash-can"></i></button>
                </div></td>
            </tr>
        `).join('');
    } 
    else if (submodul === 'pegawai') {
        html = dataToRender.map(pegawai => `
            <tr>
                <td><span class="cell-main-text">${pegawai.nama}</span></td>
                <td><span class="cell-normal-text">${pegawai.nip}</span></td>
                <td><span class="cell-muted-text">${pegawai.status}</span></td>
                <td class="text-center"><div class="table-icon-group">
                    <button class="btn-icon-action edit" onclick="bukaModalPengaturan('pegawai', ${JSON.stringify(pegawai).replace(/"/g, '&quot;')})"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn-icon-action delete" onclick="hapusPengaturan('pegawai', '${pegawai.nip}')"><i class="fa-solid fa-trash-can"></i></button>
                </div></td>
            </tr>
        `).join('');
    }

    tbody.innerHTML = html;
}

// Fitur Pencarian Lokal Khusus Pegawai (Karena datanya berpotensi banyak)
function filterPengaturanPegawaiLokal() {
    const keyword = document.getElementById('pengaturan-pegawai-search').value.toLowerCase();
    const tbody = document.getElementById('tabel-pengaturan-pegawai');
    const dataTerfilter = dataPengaturan['pegawai'].filter(p => 
        p.nama.toLowerCase().includes(keyword) || 
        p.nip.toLowerCase().includes(keyword) || 
        p.status.toLowerCase().includes(keyword)
    );
    
    // Simpan sementara ke backup lalu render
    const backupData = dataPengaturan['pegawai'];
    dataPengaturan['pegawai'] = dataTerfilter;
    renderTabelPengaturan('pegawai');
    dataPengaturan['pegawai'] = backupData; // Kembalikan data utuh
}

// ==========================================
// MANAJEMEN MODAL DINAMIS PENGATURAN
// ==========================================
function bukaModalPengaturan(submodul, dataEdit = null) {
    const modal = document.getElementById('modalPengaturan');
    const title = document.getElementById('modalPengaturanTitle');
    const formContainer = document.getElementById('form-fields-pengaturan');
    const idLamaInput = document.getElementById('pengaturan-id-lama');
    
    document.getElementById('pengaturan-modul').value = submodul;
    formContainer.innerHTML = ''; // Bersihkan isian sebelumnya

    let isEdit = dataEdit !== null;
    idLamaInput.value = '';

    if (submodul === 'jenis') {
        title.innerHTML = isEdit ? '<i class="fa-solid fa-pen-to-square"></i> Edit Jenis Surat' : '<i class="fa-solid fa-plus"></i> Tambah Jenis Surat';
        if (isEdit) idLamaInput.value = dataEdit; // dataEdit berupa string nama jenis surat
        
        formContainer.innerHTML = `
            <div class="form-group margin-bottom">
                <label>Nama Jenis Surat *</label>
                <input type="text" id="pengaturan-jenis-nilai" value="${isEdit ? dataEdit : ''}" required placeholder="Contoh: Surat Edaran">
            </div>
        `;
    } 
    else if (submodul === 'admin') {
        title.innerHTML = isEdit ? '<i class="fa-solid fa-user-pen"></i> Edit Admin' : '<i class="fa-solid fa-user-plus"></i> Tambah Admin';
        if (isEdit) idLamaInput.value = dataEdit.username;
        
        formContainer.innerHTML = `
            <div class="form-group margin-bottom">
                <label>Nama *</label>
                <input type="text" id="pengaturan-admin-nama" value="${isEdit ? dataEdit.nama : ''}" required autocomplete="off">
            </div>
            <div class="form-group margin-bottom">
                <label>Username *</label>
                <input type="text" id="pengaturan-admin-username" value="${isEdit ? dataEdit.username : ''}" required autocomplete="off">
            </div>
            <div class="form-group margin-bottom">
                <label>Password ${isEdit ? '<small style="color:#e53e3e;">(Kosongkan jika tidak ingin diubah)</small>' : '*'}</label>
                <input type="password" id="pengaturan-admin-pass" ${isEdit ? '' : 'required'} placeholder="Ketik sandi rahasia..." autocomplete="new-password">
            </div>
            <div class="form-group margin-bottom">
                <label>Hak Akses (Role) *</label>
                <select id="pengaturan-admin-role" required>
                    <option value="Admin" ${isEdit && dataEdit.role === 'Admin' ? 'selected' : ''}>Admin (Standar)</option>
                    <option value="Super Admin" ${isEdit && dataEdit.role === 'Super Admin' ? 'selected' : ''}>Super Admin</option>
                </select>
            </div>
        `;
    } 
    else if (submodul === 'pegawai') {
        title.innerHTML = isEdit ? '<i class="fa-solid fa-pen-to-square"></i> Edit Pegawai' : '<i class="fa-solid fa-plus"></i> Tambah Pegawai';
        if (isEdit) idLamaInput.value = dataEdit.nip;
        
        formContainer.innerHTML = `
            <div class="form-group margin-bottom">
                <label>Nama *</label>
                <input type="text" id="pengaturan-pegawai-nama" value="${isEdit ? dataEdit.nama : ''}" required>
            </div>
            <div class="form-group margin-bottom">
                <label>NIP *</label>
                <input type="text" id="pengaturan-pegawai-nip" value="${isEdit ? dataEdit.nip : ''}" required>
            </div>
            <div class="form-group margin-bottom">
                <label>Status Kepegawaian *</label>
                <select id="pengaturan-pegawai-status" required>
                    <option value="PNS" ${isEdit && dataEdit.status === 'PNS' ? 'selected' : ''}>PNS</option>
                    <option value="PPPK" ${isEdit && dataEdit.status === 'PPPK' ? 'selected' : ''}>PPPK</option>
                    <option value="PPPKPW" ${isEdit && dataEdit.status === 'PPPKPW' ? 'selected' : ''}>PPPKPW</option>
                </select>
            </div>
        `;
    }

    modal.style.display = 'flex';
}

function tutupModalPengaturan() {
    document.getElementById('modalPengaturan').style.display = 'none';
}

// ==========================================
// EKSEKUSI CRUD PENGATURAN (SIMPAN/EDIT)
// ==========================================
async function handleSimpanPengaturan(event) {
    event.preventDefault();
    
    const btnSubmit = document.getElementById('btn-submit-pengaturan');
    const originalText = btnSubmit.innerText;
    
    const submodul = document.getElementById('pengaturan-modul').value;
    const idLama = document.getElementById('pengaturan-id-lama').value;
    const tipeCrud = idLama ? 'update' : 'add';

    btnSubmit.innerHTML = `<span class="spinner"></span> Menyimpan...`;
    btnSubmit.disabled = true;

    // Susun Payload Dasar
    let payload = {
        action: 'crudPengaturan',
        modul: submodul,
        tipeCrud: tipeCrud,
        idLama: idLama,
        username: userMasuk ? userMasuk.username : '',
        role: userMasuk ? userMasuk.role : ''
    };

    // Ambil Data Spesifik Form
    if (submodul === 'jenis') {
        payload.nilai = document.getElementById('pengaturan-jenis-nilai').value.trim();
    } else if (submodul === 'admin') {
        payload.nama = document.getElementById('pengaturan-admin-nama').value.trim();
        payload.username = document.getElementById('pengaturan-admin-username').value.trim(); // Username baru
        payload.password = document.getElementById('pengaturan-admin-pass').value.trim();
        payload.roleAkses = document.getElementById('pengaturan-admin-role').value;
    } else if (submodul === 'pegawai') {
        payload.nama = document.getElementById('pengaturan-pegawai-nama').value.trim();
        payload.nip = document.getElementById('pengaturan-pegawai-nip').value.trim(); // NIP baru
        payload.statusPegawai = document.getElementById('pengaturan-pegawai-status').value;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.status === 'success') {
            
            // --- KODE DETEKSI EDIT DIRI SENDIRI ---
            if (submodul === 'admin' && tipeCrud === 'update' && userMasuk && idLama === userMasuk.username) {
                Swal.fire({
                    title: 'Pembaruan Berhasil',
                    text: 'Anda telah mengubah kredensial/data akun Anda sendiri. Demi keamanan, silakan login kembali.',
                    icon: 'success',
                    confirmButtonColor: '#1a365d',
                    allowOutsideClick: false
                }).then(() => {
                    localStorage.removeItem('currentUser'); // Hapus sesi
                    window.location.replace('login.html'); // Tendang ke login
                });
                return; // Hentikan eksekusi kode di bawahnya
            }
            // --------------------------------------

            // Eksekusi normal jika yang diedit/ditambah BUKAN diri sendiri
            TampilkanToast('success', result.data.message);
            tutupModalPengaturan();
            
            fetchPengaturanData(submodul);

            if (submodul === 'jenis' || submodul === 'pegawai') {
                statusMemuatReferensi = false; 
                referensiSudahDimuat = false;
                muatReferensiGlobal();
            }
        } else {
            TampilkanAlert('error', 'Gagal', result.message);
        }
    } catch (error) {
        TampilkanToast('error', 'Terjadi kesalahan jaringan.');
    } finally {
        btnSubmit.innerText = originalText;
        btnSubmit.disabled = false;
    }
}

// ==========================================
// EKSEKUSI CRUD PENGATURAN (HAPUS 2-LANGKAH)
// ==========================================
function hapusPengaturan(submodul, idLama) {
    // --- KODE PENCEGAT HAPUS DIRI SENDIRI ---
    if (submodul === 'admin' && userMasuk && idLama === userMasuk.username) {
        Swal.fire({
            icon: 'error',
            title: 'Tindakan Ditolak',
            text: 'Anda tidak dapat menghapus akun Anda sendiri saat sedang menggunakannya!',
            confirmButtonColor: '#1a365d'
        });
        return; // Hentikan proses ke bawah
    }
    // ----------------------------------------

    Swal.fire({
        title: 'Hapus Data Permanen?',
        text: "Tindakan ini tidak bisa dibatalkan.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal',
    }).then((result) => {
        if (result.isConfirmed) {
            
            const kodeKonfirmasiSistem = Math.floor(1000 + Math.random() * 9000).toString();

            Swal.fire({
                title: 'Otorisasi Penghapusan',
                html: `Ketik 4 digit PIN eksekutor ini:<br><br>
                       <b style="font-size: 2.2rem; color: #dc2626; letter-spacing: 6px; font-family: monospace;">${kodeKonfirmasiSistem}</b>`,
                input: 'text',
                inputAttributes: {
                    maxlength: 4,
                    autofocus: 'true',
                    style: 'text-align: center; font-size: 1.6rem; font-weight: bold; letter-spacing: 6px; width: 160px; margin: 15px auto 0; border-radius: 8px;'
                },
                showCancelButton: true,
                confirmButtonText: 'Konfirmasi Hapus',
                confirmButtonColor: '#dc2626',
                cancelButtonText: 'Batal',
                preConfirm: (inputUser) => {
                    if (inputUser !== kodeKonfirmasiSistem) {
                        Swal.showValidationMessage('PIN verifikasi salah!');
                    }
                    return inputUser === kodeKonfirmasiSistem;
                }
            }).then(async (validationResult) => {
                if (validationResult.isConfirmed) {
                    
                    Swal.fire({
                        title: 'Menghapus Data...',
                        allowOutsideClick: false,
                        didOpen: () => { Swal.showLoading(); }
                    });

                    try {
                        const response = await fetch(API_URL, {
                            method: 'POST',
                            body: JSON.stringify({
                                action: 'crudPengaturan',
                                modul: submodul,
                                tipeCrud: 'delete',
                                idLama: idLama,
                                username: userMasuk ? userMasuk.username : '',
                                role: userMasuk ? userMasuk.role : ''
                            })
                        });
                        const res = await response.json();

                        if (res.status === 'success') {
                            TampilkanAlert('success', 'Terhapus!', res.data.message);
                            fetchPengaturanData(submodul);
                            
                            // Segarkan dropdown global form surat
                            if (submodul === 'jenis' || submodul === 'pegawai') {
                                statusMemuatReferensi = false; 
                                referensiSudahDimuat = false;
                                muatReferensiGlobal();
                            }
                        } else {
                            TampilkanAlert('error', 'Gagal Dihapus', res.message);
                        }
                    } catch (error) {
                        TampilkanToast('error', 'Koneksi ke server gagal.');
                    }
                }
            });
        }
    });
}

// ==========================================
// VALIDASI SESI LATAR BELAKANG (KEAMANAN)
// ==========================================
async function validasiSesiLatarBelakang() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return; // Jika tidak ada sesi, abaikan. Biarkan script di index.html yang menangani.

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'verifyUser',
                username: user.username
            })
        });
        const result = await response.json();

        // Jika server menjawab error (akun sudah dihapus dari sheet)
        if (result.status === 'error') {
            // 1. Hapus memori kunci di browser
            localStorage.removeItem('currentUser'); 
            
            // 2. Tampilkan peringatan keras dan tendang ke halaman login
            Swal.fire({
                icon: 'error',
                title: 'Akses Ditolak',
                text: 'Akun Anda telah dicabut atau dinonaktifkan oleh sistem.',
                confirmButtonColor: '#dc2626',
                allowOutsideClick: false,
                allowEscapeKey: false
            }).then(() => {
                window.location.replace('login.html');
            });
        }
    } catch (error) {
        // Abaikan secara senyap jika terjadi error jaringan sementara (offline)
        console.log("Validasi sesi tertunda: Koneksi terputus.");
    }
}

// Eksekusi fungsi secara otomatis dengan jeda 1,5 detik setiap kali aplikasi dimuat, 
// agar tidak mengganggu kecepatan loading animasi tabel dasbor.
setTimeout(validasiSesiLatarBelakang, 1500);
