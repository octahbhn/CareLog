const API_URL = "http://localhost:3000/api";

let residents = [];

// Mengambil data warga dari PostgreSQL
async function loadResidents() {
    try {
        const response = await fetch(`${API_URL}/residents`);

        if (!response.ok) {
            throw new Error("Gagal mengambil data warga");
        }

        const result = await response.json();

        residents = result.data.map(resident => ({
            id: resident.id,
            nik: resident.nik,
            nama: resident.name,
            tanggalLahir: resident.birth_date
                ? resident.birth_date.substring(0, 10)
                : "",
            jenisKelamin: resident.gender,
            kategori: resident.category,
            alamat: resident.address
        }));

        renderResidents();
        updateDashboard();
        populateResidentSelect();

    } catch (error) {
        console.error("Error:", error);
        alert("Tidak dapat mengambil data warga dari server.");
    }
}

// Mengisi dropdown warga dengan Select2
function populateResidentSelect() {
    const residentSelect = document.getElementById("residentSelect");

    if (!residentSelect) return;

    residentSelect.innerHTML = `
        <option value="">Pilih warga terdaftar</option>
    `;

    residents.forEach(resident => {
        const option = document.createElement("option");

        option.value = resident.id;
        option.textContent = `${resident.nama} - ${resident.nik}`;

        residentSelect.appendChild(option);
    });

    if (window.jQuery && !$(residentSelect).hasClass("select2-hidden-accessible")) {
        $(residentSelect).select2({
            placeholder: "Cari nama atau NIK warga...",
            allowClear: true,
            width: "100%"
        });
    }
}

// Menampilkan profil warga yang dipilih
function showResidentProfile() {
    const residentSelect = document.getElementById("residentSelect");
    const residentProfile = document.getElementById("residentProfile");

    if (!residentSelect || !residentProfile) return;

    const selectedId = Number(residentSelect.value);

    const resident = residents.find(
        item => item.id === selectedId
    );

    if (!resident) {
        residentProfile.style.display = "none";
        return;
    }

    document.getElementById("profileNIK").textContent = resident.nik;
    document.getElementById("profileBirthDate").textContent = resident.tanggalLahir;
    document.getElementById("profileGender").textContent = resident.jenisKelamin;
    document.getElementById("profileCategory").textContent = resident.kategori;

    residentProfile.style.display = "block";
}

const residentSelect = document.getElementById("residentSelect");

if (residentSelect) {
    residentSelect.addEventListener("change", showResidentProfile);
}

// Mengamankan teks sebelum ditampilkan ke HTML
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

// DASHBOARD
async function updateDashboard() {
    const totalWargaElement = document.getElementById(
        "dashboardTotalWarga"
    );

    const totalPemeriksaanElement = document.getElementById(
        "dashboardTotalPemeriksaan"
    );

    const totalKategoriElement = document.getElementById(
        "dashboardTotalKategori"
    );

    // Jika bukan halaman Dashboard, hentikan fungsi
    if (!totalWargaElement) return;

    try {
        // Mengambil data pemeriksaan dari database melalui API
        const response = await fetch(`${API_URL}/examinations`);
        const result = await response.json();

        if (!response.ok) {
            throw new Error("Gagal mengambil data pemeriksaan");
        }

        const examinations = result.data || [];

        // Memperbarui statistik Dashboard
        totalWargaElement.textContent = residents.length;
        totalPemeriksaanElement.textContent = examinations.length;
        totalKategoriElement.textContent = 3;

    } catch (error) {
        console.error("Gagal memperbarui Dashboard:", error);
    }
}

// Statistik halaman Data Warga
function updateResidentStatistics() {
    const totalWarga = residents.length;

    const totalBalita = residents.filter(
        resident => resident.kategori === "Bayi/Balita"
    ).length;

    const totalIbuHamilLansia = residents.filter(
        resident =>
            resident.kategori === "Ibu Hamil" ||
            resident.kategori === "Lansia"
    ).length;

    const totalWargaElement = document.getElementById("totalWarga");
    const totalBalitaElement = document.getElementById("totalBalita");
    const totalIbuHamilLansiaElement = document.getElementById("totalIbuHamilLansia");

    if (totalWargaElement) {
        totalWargaElement.textContent = totalWarga;
    }

    if (totalBalitaElement) {
        totalBalitaElement.textContent = totalBalita;
    }

    if (totalIbuHamilLansiaElement) {
        totalIbuHamilLansiaElement.textContent = totalIbuHamilLansia;
    }
}

const formTambahWarga = document.getElementById("formTambahWarga");
const residentTableBody = document.getElementById("residentTableBody");
const searchResident = document.getElementById("searchResident");
const filterCategory = document.getElementById("filterCategory");

let editingResidentId = null;

// Menampilkan tabel warga
function renderResidents() {
    if (!residentTableBody) return;

    const keyword = searchResident.value.toLowerCase().trim();
    const category = filterCategory.value;

    const filteredResidents = residents.filter(resident => {
        const matchesSearch =
            resident.nik.toLowerCase().includes(keyword) ||
            resident.nama.toLowerCase().includes(keyword);

        const matchesCategory =
            category === "" || resident.kategori === category;

        return matchesSearch && matchesCategory;
    });

    if (filteredResidents.length === 0) {
        residentTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <div class="empty-icon">♙</div>
                    <h6>${residents.length === 0
                        ? "Belum Ada Data Warga"
                        : "Data Tidak Ditemukan"}</h6>
                    <p>${residents.length === 0
                        ? "Tambahkan profil warga untuk mulai mengelola data Posyandu."
                        : "Coba gunakan kata kunci atau kategori lainnya."}</p>
                </td>
            </tr>
        `;
    } else {
        residentTableBody.innerHTML = filteredResidents.map(
            (resident, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${escapeHTML(resident.nik)}</td>
                    <td>${escapeHTML(resident.nama)}</td>
                    <td>${escapeHTML(resident.tanggalLahir)}</td>
                    <td>
                        <span class="category-badge">
                            ${escapeHTML(resident.kategori)}
                        </span>
                    </td>
                    <td>
                        <div class="d-flex gap-2">

                            <button
                                class="btn btn-sm btn-outline-info"
                                onclick="viewResident('${resident.id}')">
                                Lihat
                            </button>
                            <button
                                class="btn btn-sm btn-outline-primary"
                                onclick="editResident('${resident.id}')">
                                Edit
                            </button>

                            <button
                                class="btn btn-sm btn-outline-danger"
                                onclick="deleteResident('${resident.id}')">
                                Hapus
                            </button>
                        </div>
                    </td>
                                    </tr>
            `
        ).join("");
    }

    updateResidentStatistics();
}

// Menambahkan dan mengedit data warga
if (formTambahWarga) {
    formTambahWarga.addEventListener("submit", async function(event) {
        event.preventDefault();

        const nik = document.getElementById("nik").value.trim();
        const nama = document.getElementById("nama").value.trim();
        const tanggalLahir = document.getElementById("tanggalLahir").value;
        const jenisKelamin = document.getElementById("jenisKelamin").value;
        const kategori = document.getElementById("kategori").value;
        const alamat = document.getElementById("alamat").value.trim();

        if (!/^\d{16}$/.test(nik)) {
            alert("NIK harus terdiri dari 16 digit angka.");
            return;
        }

        const duplicateNIK = residents.some(resident =>
            resident.nik === nik &&
            resident.id !== editingResidentId
        );

        if (duplicateNIK) {
            alert("NIK sudah terdaftar.");
            return;
        }

        const isEditing = editingResidentId !== null;

        try {
            const url = isEditing
                ? `${API_URL}/residents/${editingResidentId}`
                : `${API_URL}/residents`;

            const response = await fetch(url, {
                method: isEditing ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    nik,
                    name: nama,
                    birth_date: tanggalLahir,
                    gender: jenisKelamin,
                    category: kategori,
                    address: alamat
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Gagal menyimpan data warga."
                );
            }

            await loadResidents();

            formTambahWarga.reset();
            editingResidentId = null;

            document.getElementById("modalTitle").textContent =
                "Tambah Data Warga";

            document.getElementById("modalDescription").textContent =
                "Masukkan informasi profil warga.";

            document.getElementById("btnSubmitWarga").textContent =
                "Simpan Data";

            const modalElement = document.getElementById("modalTambahWarga");
            const modal = bootstrap.Modal.getInstance(modalElement);

            if (modal) modal.hide();

            alert(
                isEditing
                    ? "Data warga berhasil diperbarui!"
                    : "Data warga berhasil ditambahkan!"
            );

        } catch (error) {
            console.error("Error:", error);
            alert(error.message);
        }
    });
}

// Mengedit data warga
function editResident(id) {
    const resident = residents.find(
        resident => resident.id === Number(id)
    );

    if (!resident) {
        alert("Data warga tidak ditemukan.");
        return;
    }

    editingResidentId = resident.id;

    document.getElementById("nik").value = resident.nik;
    document.getElementById("nama").value = resident.nama;
    document.getElementById("tanggalLahir").value = resident.tanggalLahir;
    document.getElementById("jenisKelamin").value = resident.jenisKelamin;
    document.getElementById("kategori").value = resident.kategori;
    document.getElementById("alamat").value = resident.alamat;

    document.getElementById("modalTitle").textContent = "Edit Data Warga";
    document.getElementById("modalDescription").textContent =
        "Perbarui informasi profil warga.";
    document.getElementById("btnSubmitWarga").textContent = "Simpan Perubahan";

    const modal = new bootstrap.Modal(
        document.getElementById("modalTambahWarga")
    );

    modal.show();
}

// Melihat detail data warga
function viewResident(id) {
    const resident = residents.find(
        resident => resident.id === Number(id)
    );

    if (!resident) {
        alert("Data warga tidak ditemukan.");
        return;
    }

    document.getElementById("detailNama").textContent = resident.nama;
    document.getElementById("detailNIK").textContent = resident.nik;
    document.getElementById("detailTanggalLahir").textContent = resident.tanggalLahir;
    document.getElementById("detailJenisKelamin").textContent = resident.jenisKelamin;
    document.getElementById("detailKategori").textContent = resident.kategori;
    document.getElementById("detailAlamat").textContent = resident.alamat;

    const modal = new bootstrap.Modal(
        document.getElementById("modalDetailWarga")
    );

    modal.show();
}

// Menambahkan warga baru
const modalTambahElement = document.getElementById("modalTambahWarga");

if (modalTambahElement) {
    modalTambahElement.addEventListener("hidden.bs.modal", function() {
        editingResidentId = null;
        formTambahWarga.reset();

        document.getElementById("modalTitle").textContent =
            "Tambah Data Warga";

        document.getElementById("modalDescription").textContent =
            "Masukkan informasi profil warga.";

        document.getElementById("btnSubmitWarga").textContent =
            "Simpan Data";
    });
}

// Menghapus data warga dari PostgreSQL
async function deleteResident(id) {
    if (!confirm("Apakah kamu yakin ingin menghapus data warga ini?")) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/residents/${id}`, {
            method: "DELETE"
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Gagal menghapus data warga");
        }

        await loadResidents();

        alert("Data warga berhasil dihapus!");

    } catch (error) {
        console.error("Error:", error);
        alert(error.message);
    }
}

// Pencarian dan filter
if (searchResident) {
    searchResident.addEventListener("input", renderResidents);
}

if (filterCategory) {
    filterCategory.addEventListener("change", renderResidents);
}

// INITIALIZATION
loadResidents();

// Menyimpan hasil pemeriksaan ke PostgreSQL
const formPemeriksaan = document.getElementById("formPemeriksaan");

if (formPemeriksaan) {
    formPemeriksaan.addEventListener("submit", async function(event) {
        event.preventDefault();

        const residentId = document.getElementById("residentSelect").value;
        const examinationDate = document.getElementById("examinationDate").value;

        if (!residentId || !examinationDate) {
            alert("Pilih warga dan isi tanggal pemeriksaan terlebih dahulu.");
            return;
        }

        // Mengubah input angka kosong menjadi null
        const getNumber = (id) => {
            const value = document.getElementById(id).value;
            return value === "" ? null : Number(value);
        };

        const dataPemeriksaan = {
            resident_id: Number(residentId),
            examination_date: examinationDate,
            weight: getNumber("weight"),
            height: getNumber("height"),
            head_circumference: getNumber("headCircumference"),
            arm_circumference: getNumber("armCircumference"),
            blood_pressure: document.getElementById("bloodPressure").value.trim() || null,
            abdominal_circumference: getNumber("abdominalCircumference"),
            immunization_status: document.getElementById("immunizationStatus").value.trim() || null,
            vitamin_status: document.getElementById("vitaminStatus").value.trim() || null,
            fundal_height: getNumber("fundalHeight"),
            gestational_age: getNumber("gestationalAge")
        };

        try {
            const response = await fetch(`${API_URL}/examinations`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(dataPemeriksaan)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Gagal menyimpan pemeriksaan.");
            }

            alert("Data pemeriksaan berhasil disimpan!");

            formPemeriksaan.reset();

            document.getElementById("residentProfile").style.display = "none";

            if (window.jQuery) {
                $("#residentSelect").val(null).trigger("change");
            }

        } catch (error) {
            console.error("Error menyimpan pemeriksaan:", error);
            alert(error.message);
        }
    });
}

// Mengambil dan menampilkan riwayat pemeriksaan
let examinationHistory = [];

async function loadExaminationHistory() {
    const historyTableBody = document.getElementById("historyTableBody");

    if (!historyTableBody) return;

    try {
        const response = await fetch(`${API_URL}/examinations`);

        if (!response.ok) {
            throw new Error("Gagal mengambil riwayat pemeriksaan.");
        }

        const result = await response.json();
        examinationHistory = result.data;

        renderExaminationHistory();

    } catch (error) {
        console.error("Error riwayat pemeriksaan:", error);

        historyTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    Gagal memuat riwayat pemeriksaan.
                </td>
            </tr>
        `;
    }
}

// Menampilkan data riwayat ke tabel
function renderExaminationHistory() {
    const historyTableBody = document.getElementById("historyTableBody");

    if (!historyTableBody) return;

    const keyword = document.getElementById("searchHistory").value.toLowerCase().trim();
    const category = document.getElementById("filterHistoryCategory").value;

    const filteredHistory = examinationHistory.filter(item => {
        const matchesSearch =
            item.resident_name.toLowerCase().includes(keyword) ||
            item.resident_nik.toLowerCase().includes(keyword);

        const matchesCategory =
            category === "" || item.resident_category === category;

        return matchesSearch && matchesCategory;
    });

    if (filteredHistory.length === 0) {
        historyTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <div class="empty-icon">◷</div>
                    <h6>Belum Ada Riwayat Pemeriksaan</h6>
                    <p>Data pemeriksaan belum ditemukan.</p>
                </td>
            </tr>
        `;
    } else {
        historyTableBody.innerHTML = filteredHistory.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${new Date(item.examination_date).toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC"
                })}</td>
                <td>${escapeHTML(item.resident_name)}</td>
                <td>${escapeHTML(item.resident_nik)}</td>
                <td>
                    <span class="category-badge">
                        ${escapeHTML(item.resident_category)}
                    </span>
                </td>
                <td>
                    <button
                        class="btn btn-sm btn-outline-info"
                        onclick="viewExaminationDetail(${item.id})">
                        Lihat
                    </button>
                </td>
            </tr>
        `).join("");
    }

    updateHistoryStatistics();
}

// Menghitung statistik riwayat
function updateHistoryStatistics() {
    const total = examinationHistory.length;

    const now = new Date();

    const monthly = examinationHistory.filter(item => {
        const date = new Date(item.examination_date);

        return date.getUTCMonth() === now.getMonth() &&
               date.getUTCFullYear() === now.getFullYear();
    }).length;

    const uniqueResidents = new Set(
        examinationHistory.map(item => item.resident_id)
    ).size;

    document.getElementById("totalHistory").textContent = total;
    document.getElementById("monthlyHistory").textContent = monthly;
    document.getElementById("residentHistory").textContent = uniqueResidents;
}

// Melihat detail hasil pemeriksaan
function viewExaminationDetail(id) {
    const item = examinationHistory.find(
        examination => examination.id === Number(id)
    );

    if (!item) {
        alert("Data pemeriksaan tidak ditemukan.");
        return;
    }

    const content = document.getElementById("detailHistoryContent");

    content.innerHTML = `
        <h6 class="mb-3">Informasi Warga</h6>
        <p><strong>Nama:</strong> ${escapeHTML(item.resident_name)}</p>
        <p><strong>NIK:</strong> ${escapeHTML(item.resident_nik)}</p>
        <p><strong>Kategori:</strong> ${escapeHTML(item.resident_category)}</p>

        <hr>

        <h6 class="mb-3">Hasil Pemeriksaan</h6>
        <p><strong>Tanggal:</strong> ${new Date(item.examination_date).toLocaleDateString("id-ID", { timeZone: "UTC" })}</p>
        <p><strong>Berat Badan:</strong> ${item.weight ?? "-" } kg</p>
        <p><strong>Tinggi Badan:</strong> ${item.height ?? "-"} cm</p>
        <p><strong>Lingkar Kepala:</strong> ${item.head_circumference ?? "-"} cm</p>
        <p><strong>Lingkar Lengan:</strong> ${item.arm_circumference ?? "-"} cm</p>
        <p><strong>Tekanan Darah:</strong> ${escapeHTML(item.blood_pressure ?? "-")}</p>
        <p><strong>Lingkar Perut:</strong> ${item.abdominal_circumference ?? "-"} cm</p>
        <p><strong>Status Imunisasi:</strong> ${escapeHTML(item.immunization_status ?? "-")}</p>
        <p><strong>Status Vitamin:</strong> ${escapeHTML(item.vitamin_status ?? "-")}</p>
        <p><strong>Tinggi Fundus Uteri:</strong> ${item.fundal_height ?? "-"} cm</p>
        <p><strong>Usia Kehamilan:</strong> ${item.gestational_age ?? "-"} minggu</p>
    `;

    const modal = new bootstrap.Modal(
        document.getElementById("modalDetailPemeriksaan")
    );

    modal.show();
}

// Pencarian dan filter riwayat
const searchHistory = document.getElementById("searchHistory");
const filterHistoryCategory = document.getElementById("filterHistoryCategory");

if (searchHistory) {
    searchHistory.addEventListener("input", renderExaminationHistory);
}

if (filterHistoryCategory) {
    filterHistoryCategory.addEventListener("change", renderExaminationHistory);
}

// Memuat riwayat saat halaman dibuka
loadExaminationHistory();
