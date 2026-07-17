CREATE DATABASE IF NOT EXISTS seventh_reaction
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE seventh_reaction;

CREATE TABLE IF NOT EXISTS players (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  nickname VARCHAR(32) NOT NULL,
  class_name VARCHAR(40) NOT NULL,
  course_id VARCHAR(24) NULL,
  current_chapter TINYINT UNSIGNED NOT NULL DEFAULT 0,
  current_run_score INT UNSIGNED NOT NULL DEFAULT 0,
  total_score BIGINT UNSIGNED NOT NULL DEFAULT 0,
  progress_percent DECIMAL(5,2) UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_players_username (username),
  UNIQUE KEY uq_players_nickname (nickname),
  KEY idx_players_course_score (course_id, total_score),
  KEY idx_players_chapter (current_chapter),
  CONSTRAINT chk_players_chapter CHECK (current_chapter BETWEEN 0 AND 7),
  CONSTRAINT chk_players_course CHECK (course_id IS NULL OR course_id IN ('basic', 'civil', 'mechanical', 'electrical'))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS player_progress (
  player_id BIGINT UNSIGNED NOT NULL,
  state_json JSON NOT NULL,
  run_id VARCHAR(80) NOT NULL,
  position_x DECIMAL(8,2) NOT NULL DEFAULT 4936,
  position_y DECIMAL(8,2) NOT NULL DEFAULT 7592,
  completed_chapters JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (player_id),
  KEY idx_progress_run (run_id),
  CONSTRAINT fk_progress_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS web_sessions (
  session_namespace VARCHAR(32) NOT NULL,
  session_id VARCHAR(128) NOT NULL,
  session_data MEDIUMBLOB NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (session_namespace, session_id),
  KEY idx_web_sessions_expiry (expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS course_scores (
  course_id VARCHAR(24) NOT NULL,
  total_score BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (course_id)
) ENGINE=InnoDB;

INSERT INTO course_scores (course_id, total_score) VALUES
  ('basic', 0),
  ('civil', 0),
  ('mechanical', 0),
  ('electrical', 0)
ON DUPLICATE KEY UPDATE course_id = VALUES(course_id);

CREATE TABLE IF NOT EXISTS score_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  player_id BIGINT UNSIGNED NULL,
  run_id VARCHAR(80) NOT NULL,
  question_id VARCHAR(80) NOT NULL,
  course_id VARCHAR(24) NOT NULL,
  points SMALLINT UNSIGNED NOT NULL DEFAULT 300,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_score_event (player_id, run_id, question_id),
  KEY idx_score_course (course_id, created_at),
  KEY idx_score_player (player_id, created_at),
  CONSTRAINT fk_score_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL,
  CONSTRAINT chk_score_points CHECK (points = 300),
  CONSTRAINT chk_score_course CHECK (course_id IN ('basic', 'civil', 'mechanical', 'electrical'))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS chapter_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  player_id BIGINT UNSIGNED NOT NULL,
  run_id VARCHAR(80) NOT NULL,
  chapter_id TINYINT UNSIGNED NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  attempts_used SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_attempt_player_chapter (player_id, chapter_id),
  CONSTRAINT fk_attempt_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  CONSTRAINT chk_attempt_chapter CHECK (chapter_id BETWEEN 1 AND 7)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admins (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  singleton_key TINYINT UNSIGNED NOT NULL DEFAULT 1,
  username VARCHAR(80) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_username (username),
  UNIQUE KEY uq_admin_singleton (singleton_key),
  CONSTRAINT chk_admin_singleton CHECK (singleton_key = 1)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(60) NOT NULL,
  target_player_id BIGINT UNSIGNED NULL,
  details VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_created (created_at),
  KEY idx_audit_admin (admin_id),
  CONSTRAINT fk_audit_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- The application intentionally supports one and only one administrator.
-- Provision that account after importing this schema by running
-- database/migrate_single_admin.php with SEVENTH_REACTION_ADMIN_PASSWORD set.
