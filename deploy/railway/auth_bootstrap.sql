-- 登录最小集:IAM 表 + 演示账号(密码统一 demo123)
-- 用途:把后端(sql-engine)指向的 MySQL 初始化到「能登录」的状态。
-- hash = sha256("agenticdatahub:" + password)。MySQL→MySQL,直接复用现有 DDL。
-- 幂等:IF NOT EXISTS + INSERT IGNORE,可重复执行。

CREATE TABLE IF NOT EXISTS users (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id     BIGINT NOT NULL,
    email         VARCHAR(255) NOT NULL,
    name          VARCHAR(128),
    status        ENUM('active','inactive','pending') DEFAULT 'active',
    password_hash VARCHAR(128) NULL COMMENT 'sha256(pepper:password)',
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_tenant_email (tenant_id, email),
    INDEX idx_tenant (tenant_id),
    INDEX idx_status (tenant_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工作区成员';

CREATE TABLE IF NOT EXISTS roles (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id    BIGINT NOT NULL,
    name         VARCHAR(128) NOT NULL,
    scope        JSON NOT NULL COMMENT 'RBAC 权限范围',
    member_count INT DEFAULT 0,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_tenant_name (tenant_id, name),
    INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色定义';

CREATE TABLE IF NOT EXISTS user_roles (
    user_id     BIGINT NOT NULL,
    role_id     BIGINT NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    INDEX idx_role (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户-角色关联';

CREATE TABLE IF NOT EXISTS teams (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id   BIGINT NOT NULL,
    name        VARCHAR(128) NOT NULL,
    description VARCHAR(512),
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_tenant_name (tenant_id, name),
    INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='团队';

CREATE TABLE IF NOT EXISTS team_members (
    team_id   BIGINT NOT NULL,
    user_id   BIGINT NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (team_id, user_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='团队-成员关联';

-- ── 部门 ─────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO teams (id, tenant_id, name, description) VALUES
    (9001, 1001, '技术部', '研发与平台工程'),
    (9002, 1001, '销售部', '客户签约与营收'),
    (9003, 1001, '市场部', '品牌、获客与活动运营');

-- ── 登录账号(密码 demo123)────────────────────────────────────────────────────
INSERT IGNORE INTO users (id, tenant_id, email, name, status, password_hash) VALUES
    (90001, 1001, 'admin@acme.com',      '管理员', 'active', '542ac4a2c6d92ac78f794b45233c0de1177e17dc98a86a530ed922c52072be18'),
    (90002, 1001, 'zhang.tech@acme.com', '张伟',   'active', '542ac4a2c6d92ac78f794b45233c0de1177e17dc98a86a530ed922c52072be18'),
    (90003, 1001, 'li.tech@acme.com',    '李娜',   'active', '542ac4a2c6d92ac78f794b45233c0de1177e17dc98a86a530ed922c52072be18'),
    (90004, 1001, 'zhao.sales@acme.com', '赵敏',   'active', '542ac4a2c6d92ac78f794b45233c0de1177e17dc98a86a530ed922c52072be18'),
    (90005, 1001, 'qian.sales@acme.com', '钱锋',   'active', '542ac4a2c6d92ac78f794b45233c0de1177e17dc98a86a530ed922c52072be18'),
    (90006, 1001, 'sun.mkt@acme.com',    '孙琳',   'active', '542ac4a2c6d92ac78f794b45233c0de1177e17dc98a86a530ed922c52072be18');

UPDATE users SET password_hash = '542ac4a2c6d92ac78f794b45233c0de1177e17dc98a86a530ed922c52072be18'
WHERE id BETWEEN 90001 AND 90006 AND tenant_id = 1001 AND (password_hash IS NULL OR password_hash = '');

-- ── 成员归属 ─────────────────────────────────────────────────────────────────
INSERT IGNORE INTO team_members (team_id, user_id) VALUES
    (9001, 90001), (9001, 90002), (9001, 90003),
    (9002, 90004), (9002, 90005),
    (9003, 90006);
