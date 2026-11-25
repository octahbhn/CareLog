/*
  CareLog Database Schema (PostgreSQL)
  -----------------------------------
  Revised according to audit findings.
  All identifiers use snake_case.
*/

-- 1. Roles ------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE               -- 'warga', 'kader', 'puskesmas'
);

-- 2. Families ---------------------------------------------------
CREATE TABLE IF NOT EXISTS families (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    address     TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Posyandu (FK to users added later) ------------------------
CREATE TABLE IF NOT EXISTS posyandu (
    id               SERIAL PRIMARY KEY,
    name             VARCHAR(100) NOT NULL,
    address          TEXT,
    puskesmas_id     INTEGER NOT NULL,                -- will be linked to users(puskesmas) via ALTER later
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Warga (citizen profile) -----------------------------------
CREATE TABLE IF NOT EXISTS warga (
    id            SERIAL PRIMARY KEY,
    nik           VARCHAR(16) NOT NULL UNIQUE,
    full_name     VARCHAR(100) NOT NULL,
    birth_date    DATE NOT NULL,
    gender        VARCHAR(10) NOT NULL,
    address       TEXT NOT NULL,
    rt_rw         VARCHAR(10),
    phone         VARCHAR(20),
    target_group  VARCHAR(20) NOT NULL CHECK (
        target_group IN (
            'bayi_balita',
            'remaja',
            'usia_produktif',
            'lansia',
            'ibu_hamil'
        )
    ),
    family_id     INTEGER REFERENCES families(id) ON DELETE SET NULL,
    posyandu_id   INTEGER REFERENCES posyandu(id) ON DELETE SET NULL,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

/*
  Konsistensi hubungan keluarga:
  - `family_members` adalah sumber kebenaran utama yang mengaitkan
    warga dengan keluarga (family_id, warga_id).
  - Kolom `warga.family_id` dipertahankan untuk query cepat, namun
    nilai tersebut harus selalu disinkronkan dengan `family_members`
    pada level aplikasi (setelah insert/update ke family_members).
  - Backend akan memastikan bahwa setiap perubahan di `family_members`
    memperbarui `warga.family_id` secara otomatis.
*/

-- 5. Family Members --------------------------------------------
CREATE TABLE IF NOT EXISTS family_members (
    id          SERIAL PRIMARY KEY,
    family_id   INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    warga_id    INTEGER NOT NULL REFERENCES warga(id) ON DELETE CASCADE,
    relation    VARCHAR(30) NOT NULL,               -- e.g., 'ayah', 'ibu', 'anak'
    UNIQUE (family_id, warga_id)
);

/*
  Penjelasan konsistensi relasi keluarga:
  - `family_members` adalah sumber kebenaran utama yang mengaitkan
    seorang warga dengan keluarga tertentu.
  - Kolom `warga.family_id` tetap ada untuk query cepat, namun
    nilainya harus selalu disinkronkan dengan `family_members`.
  - Sinkronisasi dilakukan pada level aplikasi (backend) ketika
    menambahkan atau mengubah anggota keluarga: setelah insert ke
    `family_members`, aplikasi memperbarui `warga.family_id` dengan
    nilai `family_id` yang sama.  Dengan demikian, tidak ada dua
    sumber data yang bisa menjadi tidak sinkron.
*/
-- 6. Users (authentication) -------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    nik         VARCHAR(16) NOT NULL UNIQUE,
    pin_hash    VARCHAR(255) NOT NULL,               -- scrypt hash of 6‑digit PIN
    role_id     INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    warga_id    INTEGER REFERENCES warga(id) ON DELETE SET NULL,   -- only for warga accounts
    posyandu_id INTEGER REFERENCES posyandu(id) ON DELETE SET NULL, -- assignment for kader
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_warga UNIQUE (warga_id)                -- one user per warga profile
);

-- 7. Schedules (linked to Posyandu) ---------------------------
CREATE TABLE IF NOT EXISTS schedules (
    id          SERIAL PRIMARY KEY,
    posyandu_id INTEGER NOT NULL REFERENCES posyandu(id) ON DELETE CASCADE,
    title       VARCHAR(100) NOT NULL,
    description TEXT,
    start_time  TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time    TIMESTAMP WITH TIME ZONE,
    location    VARCHAR(200),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Examinations (monthly logbook) ---------------------------
CREATE TABLE IF NOT EXISTS examinations (
    id            SERIAL PRIMARY KEY,
    warga_id      INTEGER NOT NULL REFERENCES warga(id) ON DELETE RESTRICT,
    examiner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT, -- kader who performed
    posyandu_id   INTEGER NOT NULL REFERENCES posyandu(id) ON DELETE RESTRICT,
    period        DATE NOT NULL,               -- first day of month representing the period
    exam_date     DATE NOT NULL,               -- actual examination date
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (warga_id, period, posyandu_id),   -- one per warga per month per posyandu
    CONSTRAINT chk_examination_period_first_day CHECK (EXTRACT(DAY FROM period) = 1)
);

-- 9. Examination Details ---------------------------------------
CREATE TABLE IF NOT EXISTS examination_details (
    id               SERIAL PRIMARY KEY,
    examination_id   INTEGER NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
    metric_key       VARCHAR(50) NOT NULL,
    value_numeric    NUMERIC(8,2),
    value_text       TEXT,
    value_boolean    BOOLEAN,
    CONSTRAINT one_value_per_metric CHECK (
        (value_numeric IS NOT NULL)::int + (value_text IS NOT NULL)::int + (value_boolean IS NOT NULL)::int = 1
    ),
    UNIQUE (examination_id, metric_key)
);

-- 10. Notifications (in‑app) ----------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(150) NOT NULL,
    message     TEXT NOT NULL,
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Referrals ------------------------------------------------
CREATE TABLE IF NOT EXISTS referrals (
    id               SERIAL PRIMARY KEY,
    warga_id         INTEGER NOT NULL REFERENCES warga(id) ON DELETE CASCADE,
    referral_date    DATE NOT NULL,
    facility_name    VARCHAR(150) NOT NULL,
    notes            TEXT,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Audit Logs ------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(150) NOT NULL,
    table_name  VARCHAR(50),
    record_id   INTEGER,
    details     JSONB,                     -- structured change information
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Cross‑table foreign keys that need both tables ----------
-- Posyandu → Users (puskesmas) – safe addition
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_posyandu_puskesmas') THEN
        ALTER TABLE posyandu
            ADD CONSTRAINT fk_posyandu_puskesmas
            FOREIGN KEY (puskesmas_id) REFERENCES users(id) ON DELETE RESTRICT;
    END IF;
END $$;

-- Users → Posyandu (kader assignment) – make deferrable
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_posyandu_id_fkey') THEN
        ALTER TABLE users
            ALTER CONSTRAINT users_posyandu_id_fkey DEFERRABLE INITIALLY DEFERRED;
    END IF;
END $$;

-- Indexes -------------------------------------------------------

-- 14. Auth Sessions (session token tracking) --------------------------------
CREATE TABLE IF NOT EXISTS auth_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions (expires_at);

CREATE INDEX IF NOT EXISTS idx_examinations_period ON examinations (period);
CREATE INDEX IF NOT EXISTS idx_examination_details_key ON examination_details (metric_key);
