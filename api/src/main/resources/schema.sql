-- ============================================================
-- Lumina Studios — MySQL schema
-- Idempotent (CREATE TABLE IF NOT EXISTS), run on every boot.
-- Column names/types mirror the original SQLite schema so the
-- API response shapes stay identical.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'production',
  department    VARCHAR(80),
  position      VARCHAR(120),
  phone         VARCHAR(40),
  location      VARCHAR(120),
  bio           TEXT,
  skills        TEXT,
  salary        INT          NOT NULL DEFAULT 0,
  hire_date     VARCHAR(10),
  status        VARCHAR(20)  NOT NULL DEFAULT 'active',
  is_demo       TINYINT      NOT NULL DEFAULT 0,
  avatar_hue    INT          NOT NULL DEFAULT 210,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clients (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(160) NOT NULL,
  company    VARCHAR(160),
  email      VARCHAR(160),
  phone      VARCHAR(40),
  industry   VARCHAR(120),
  status     VARCHAR(20) NOT NULL DEFAULT 'active',
  notes      TEXT,
  hue        INT NOT NULL DEFAULT 160,
  created_by INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_clients_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  client_id   INT,
  type        VARCHAR(30)  NOT NULL DEFAULT 'video',
  status      VARCHAR(30)  NOT NULL DEFAULT 'booked',
  priority    VARCHAR(20)  NOT NULL DEFAULT 'medium',
  budget      DOUBLE       NOT NULL DEFAULT 0,
  spent       DOUBLE       NOT NULL DEFAULT 0,
  start_date  VARCHAR(10),
  shoot_date  VARCHAR(10),
  deadline    VARCHAR(10),
  manager_id  INT,
  description TEXT,
  progress    INT          NOT NULL DEFAULT 0,
  created_by  INT,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_projects_status (status),
  CONSTRAINT fk_projects_client  FOREIGN KEY (client_id)  REFERENCES clients(id)  ON DELETE SET NULL,
  CONSTRAINT fk_projects_manager FOREIGN KEY (manager_id) REFERENCES users(id)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tasks (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  title            VARCHAR(255) NOT NULL,
  description      TEXT,
  project_id       INT,
  assignee_id      INT,
  status           VARCHAR(20)  NOT NULL DEFAULT 'todo',
  priority         VARCHAR(20)  NOT NULL DEFAULT 'medium',
  due_date         VARCHAR(10),
  estimated_hours  DOUBLE NOT NULL DEFAULT 0,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at     DATETIME,
  created_by       INT,
  KEY idx_tasks_assignee (assignee_id),
  KEY idx_tasks_project (project_id),
  KEY idx_tasks_status (status),
  CONSTRAINT fk_tasks_project  FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_tasks_assignee FOREIGN KEY (assignee_id) REFERENCES users(id)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assets (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  type        VARCHAR(30)  NOT NULL DEFAULT 'document',
  project_id  INT,
  uploaded_by INT,
  size_mb     DOUBLE NOT NULL DEFAULT 0,
  hue         INT NOT NULL DEFAULT 200,
  tags        TEXT,
  description TEXT,
  url         VARCHAR(500),
  created_by  INT,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_assets_project (project_id),
  KEY idx_assets_type (type),
  CONSTRAINT fk_assets_project FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_assets_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS timesheets (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  project_id   INT,
  date         VARCHAR(10) NOT NULL,
  hours        DOUBLE NOT NULL DEFAULT 0,
  description  TEXT,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending',
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by   INT,
  KEY idx_ts_user (user_id),
  KEY idx_ts_status (status),
  CONSTRAINT fk_ts_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_ts_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  date       VARCHAR(10) NOT NULL,
  check_in   VARCHAR(5),
  check_out  VARCHAR(5),
  status     VARCHAR(20) NOT NULL DEFAULT 'present',
  created_by INT,
  KEY idx_att_user (user_id),
  CONSTRAINT fk_att_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payroll (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  month        VARCHAR(7) NOT NULL,
  base_salary  DOUBLE NOT NULL DEFAULT 0,
  bonus        DOUBLE NOT NULL DEFAULT 0,
  deductions   DOUBLE NOT NULL DEFAULT 0,
  net          DOUBLE NOT NULL DEFAULT 0,
  status       VARCHAR(20) NOT NULL DEFAULT 'draft',
  paid_at      DATETIME,
  created_by   INT,
  KEY idx_pay_user (user_id),
  KEY idx_pay_month (month),
  CONSTRAINT fk_pay_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT,
  action      VARCHAR(60) NOT NULL,
  target_type VARCHAR(30),
  target_id   INT,
  details     TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_act_created (created_at),
  CONSTRAINT fk_act_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Client photo gallery & album approval
CREATE TABLE IF NOT EXISTS photos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  project_id  INT NOT NULL,
  name        VARCHAR(255) NOT NULL,
  url         VARCHAR(500),
  category    VARCHAR(60),
  size_mb     DOUBLE NOT NULL DEFAULT 0,
  captured_on VARCHAR(10),
  status      VARCHAR(20) NOT NULL DEFAULT 'uploaded',
  uploaded_by INT,
  created_by  INT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_photos_project (project_id),
  KEY idx_photos_status (status),
  CONSTRAINT fk_photos_project  FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_photos_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- GST invoices & payment tracking
CREATE TABLE IF NOT EXISTS invoices (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  project_id   INT NOT NULL,
  client_id    INT,
  invoice_no   VARCHAR(30) NOT NULL UNIQUE,
  issued_on    VARCHAR(10),
  due_on       VARCHAR(10),
  base_amount  DOUBLE NOT NULL DEFAULT 0,
  gst_rate     DOUBLE NOT NULL DEFAULT 18,
  gst_amount   DOUBLE NOT NULL DEFAULT 0,
  total_amount DOUBLE NOT NULL DEFAULT 0,
  advance_paid DOUBLE NOT NULL DEFAULT 0,
  balance      DOUBLE NOT NULL DEFAULT 0,
  status       VARCHAR(20) NOT NULL DEFAULT 'draft',
  notes        TEXT,
  created_by   INT,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_invoices_project (project_id),
  KEY idx_invoices_status (status),
  CONSTRAINT fk_inv_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_inv_client  FOREIGN KEY (client_id)  REFERENCES clients(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id  INT NOT NULL,
  amount      DOUBLE NOT NULL DEFAULT 0,
  paid_on     VARCHAR(10),
  method      VARCHAR(30) NOT NULL DEFAULT 'cash',
  reference   VARCHAR(80),
  notes       TEXT,
  recorded_by INT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_payments_invoice (invoice_id),
  CONSTRAINT fk_pay_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Equipment inventory (owner-managed) with rent per event
CREATE TABLE IF NOT EXISTS inventory (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(160) NOT NULL,
  category       VARCHAR(40)  NOT NULL DEFAULT 'camera',
  brand          VARCHAR(120),
  quantity       INT          NOT NULL DEFAULT 1,
  rent_per_event DOUBLE       NOT NULL DEFAULT 0,
  notes          TEXT,
  created_by     INT,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_inventory_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cost estimations / quotations (owner + manager)
CREATE TABLE IF NOT EXISTS estimates (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  estimate_no    VARCHAR(30) NOT NULL UNIQUE,
  client_id      INT,
  event_name     VARCHAR(200) NOT NULL,
  event_type     VARCHAR(60),
  event_date     VARCHAR(10),
  days           INT          NOT NULL DEFAULT 1,
  cameras        INT          NOT NULL DEFAULT 0,
  camera_rate    DOUBLE       NOT NULL DEFAULT 0,
  employee_rate  DOUBLE       NOT NULL DEFAULT 0,
  extras_label   VARCHAR(160),
  extras_cost    DOUBLE       NOT NULL DEFAULT 0,
  equipment_cost DOUBLE       NOT NULL DEFAULT 0,
  subtotal       DOUBLE       NOT NULL DEFAULT 0,
  gst_rate       DOUBLE       NOT NULL DEFAULT 18,
  gst_amount     DOUBLE       NOT NULL DEFAULT 0,
  total          DOUBLE       NOT NULL DEFAULT 0,
  status         VARCHAR(20)  NOT NULL DEFAULT 'draft',
  notes          TEXT,
  company_name   VARCHAR(160),
  company_license VARCHAR(80),
  created_by     INT,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_estimates_client (client_id),
  KEY idx_estimates_status (status),
  CONSTRAINT fk_est_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Team members selected for an estimate
CREATE TABLE IF NOT EXISTS estimate_employees (
  estimate_id INT NOT NULL,
  user_id     INT NOT NULL,
  PRIMARY KEY (estimate_id, user_id),
  CONSTRAINT fk_ee_estimate FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE,
  CONSTRAINT fk_ee_user     FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Equipment items added to an estimate (snapshot of name + rent)
CREATE TABLE IF NOT EXISTS estimate_equipment (
  estimate_id  INT NOT NULL,
  inventory_id INT NOT NULL,
  name         VARCHAR(160),
  qty          INT    NOT NULL DEFAULT 1,
  rent         DOUBLE NOT NULL DEFAULT 0,
  PRIMARY KEY (estimate_id, inventory_id),
  CONSTRAINT fk_eq_estimate  FOREIGN KEY (estimate_id)  REFERENCES estimates(id)   ON DELETE CASCADE,
  CONSTRAINT fk_eq_inventory FOREIGN KEY (inventory_id) REFERENCES inventory(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
