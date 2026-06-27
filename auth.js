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
        borderRadius: '12px'
    });
};

// Ganti dengan URL Web App GAS milikmu
const API_URL = 'https://script.google.com/macros/s/AKfycbydZOCmWqjzMI3z-3Y0xCFELfSMXBUG9hjQ1IqbXQNLoxK8BJJ74SLDevx6ZfdcTn_L/exec';

document.addEventListener('DOMContentLoaded', () => {
    // Referensi elemen form login
    const loginForm = document.getElementById('loginForm');
    const btnLogin = document.getElementById('btnLogin');
    
    // Referensi elemen Modal
    const loginModal = document.getElementById('loginModal');
    const btnOpenLoginModal = document.getElementById('btnOpenLoginModal');
    const btnCloseLoginModal = document.getElementById('btnCloseLoginModal');

    // PROTEKSI HALAMAN
    if (localStorage.getItem('currentUser')) {
        window.location.href = 'index.html';
    }

    // --- LOGIKA UNTUK MEMBUKA/MENUTUP MODAL LOGIN ---
    if (btnOpenLoginModal) {
        btnOpenLoginModal.addEventListener('click', () => {
            loginModal.style.display = 'flex';
        });
    }

    if (btnCloseLoginModal) {
        btnCloseLoginModal.addEventListener('click', () => {
            loginModal.style.display = 'none';
        });
    }

    // Menutup modal jika area gelap di luar kotak modal diklik
    window.addEventListener('click', (e) => {
        if (e.target === loginModal) {
            loginModal.style.display = 'none';
        }
    });

    // --- LOGIKA TOGGLE PASSWORD (LIHAT/SEMBUNYIKAN) ---
    const btnTogglePassword = document.getElementById('btnTogglePassword');
    const passwordInput = document.getElementById('password');
    const eyeIcon = document.getElementById('eyeIcon');

    if (btnTogglePassword && passwordInput && eyeIcon) {
        btnTogglePassword.addEventListener('click', () => {
            // Cek tipe saat ini, lalu balikkan
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            // Ganti ikon mata menjadi mata disilang (eye-slash)
            if (type === 'text') {
                eyeIcon.classList.remove('fa-eye');
                eyeIcon.classList.add('fa-eye-slash');
            } else {
                eyeIcon.classList.remove('fa-eye-slash');
                eyeIcon.classList.add('fa-eye');
            }
        });
    }
    
    // --- LOGIKA SUBMIT LOGIN (Gunakan yang lama, tetap sama) ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();

        btnLogin.innerHTML = `<span class="spinner"></span> Memverifikasi...`;
        btnLogin.disabled = true;

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'login', username, password })
            });
            const result = await response.json();

            if (result.status === 'success' && result.data.isValid) {
                TampilkanToast('success', 'Login Berhasil! Mengalihkan halaman...');
                localStorage.setItem('currentUser', JSON.stringify(result.data.user));
                setTimeout(() => { window.location.href = 'index.html'; }, 1200);
            } else {
                TampilkanToast('error', result.message || 'Username atau Password salah.');
                resetButton();
            }
        } catch (error) {
            TampilkanToast('error', 'Gagal terhubung ke server Google.');
            resetButton();
        }
    });

    function resetButton() {
        btnLogin.innerText = 'Masuk Sistem';
        btnLogin.disabled = false;
    }
});