-- ============================================================
-- dawrpgdb — DAW: Defending a Workstation
-- ============================================================

USE dawrpgdb;

-- ── REFERENCE: heroes ────────────────────────────────────────

CREATE TABLE heroes (
  id          VARCHAR(32)   NOT NULL,
  role        VARCHAR(32)   NOT NULL,
  bio         TEXT,
  hp_max      SMALLINT      NOT NULL,
  cpu_max     SMALLINT      NOT NULL,
  spd         DECIMAL(4,2)  NOT NULL,
  atk_min     SMALLINT      NOT NULL,
  atk_max     SMALLINT      NOT NULL,
  limit_name  VARCHAR(64)   NOT NULL,
  limit_desc  VARCHAR(128)  NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE hero_scripts (
  id          VARCHAR(32)   NOT NULL,
  hero_id     VARCHAR(32)   NOT NULL,
  label       VARCHAR(64)   NOT NULL,
  cpu_cost    TINYINT       NOT NULL DEFAULT 0,
  dmg_min     SMALLINT      NOT NULL DEFAULT 0,
  dmg_max     SMALLINT      NOT NULL DEFAULT 0,
  heal_min    SMALLINT      NOT NULL DEFAULT 0,
  heal_max    SMALLINT      NOT NULL DEFAULT 0,
  kind        ENUM('single','aoe','heal','aoehel','buff','debuff') NOT NULL,
  extra       VARCHAR(32),
  description TEXT,
  PRIMARY KEY (id, hero_id),
  FOREIGN KEY (hero_id) REFERENCES heroes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── REFERENCE: items ─────────────────────────────────────────

CREATE TABLE items (
  id          VARCHAR(32)   NOT NULL,
  label       VARCHAR(64)   NOT NULL,
  kind        ENUM('heal','mp','revive','bomb') NOT NULL,
  battle_amt  SMALLINT      NOT NULL DEFAULT 0,
  price       SMALLINT      NOT NULL DEFAULT 0,
  sell_price  SMALLINT      NOT NULL DEFAULT 0,
  stock       SMALLINT      NOT NULL DEFAULT 0,
  glyph       VARCHAR(4),
  kind_label  VARCHAR(16),
  description TEXT,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── REFERENCE: enemies ───────────────────────────────────────

CREATE TABLE enemies (
  id          VARCHAR(32)   NOT NULL,
  display_no  CHAR(3)       NOT NULL,
  class       VARCHAR(32),
  where_found VARCHAR(64),
  description TEXT,
  hp          SMALLINT      NOT NULL DEFAULT 100,
  spd         DECIMAL(4,2)  NOT NULL DEFAULT 1.00,
  dmg_min     SMALLINT      NOT NULL DEFAULT 10,
  dmg_max     SMALLINT      NOT NULL DEFAULT 20,
  xp          SMALLINT      NOT NULL DEFAULT 10,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── REFERENCE: worlds & map ──────────────────────────────────

CREATE TABLE worlds (
  id        VARCHAR(8)    NOT NULL,
  name      VARCHAR(64)   NOT NULL,
  sub_title VARCHAR(128),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE world_nodes (
  node_id         VARCHAR(16)   NOT NULL,
  world_id        VARCHAR(8)    NOT NULL,
  node_type       ENUM('save','fight','mini','boss','shop') NOT NULL,
  label           VARCHAR(64)   NOT NULL,
  sub_label       VARCHAR(128),
  x_pos           SMALLINT      NOT NULL,
  y_pos           SMALLINT      NOT NULL,
  encounter_bg    VARCHAR(64),
  encounter_tier  TINYINT,
  is_boss         TINYINT(1)    NOT NULL DEFAULT 0,
  PRIMARY KEY (node_id, world_id),
  FOREIGN KEY (world_id) REFERENCES worlds(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE node_enemies (
  world_id    VARCHAR(8)    NOT NULL,
  node_id     VARCHAR(16)   NOT NULL,
  position    TINYINT       NOT NULL,
  enemy_kind  VARCHAR(32)   NOT NULL,
  PRIMARY KEY (world_id, node_id, position),
  FOREIGN KEY (world_id, node_id) REFERENCES world_nodes(world_id, node_id),
  FOREIGN KEY (enemy_kind)        REFERENCES enemies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE world_edges (
  world_id   VARCHAR(8)    NOT NULL,
  node_from  VARCHAR(16)   NOT NULL,
  node_to    VARCHAR(16)   NOT NULL,
  PRIMARY KEY (world_id, node_from, node_to),
  FOREIGN KEY (world_id, node_from) REFERENCES world_nodes(world_id, node_id),
  FOREIGN KEY (world_id, node_to)   REFERENCES world_nodes(world_id, node_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── USER ACCOUNTS ────────────────────────────────────────────

CREATE TABLE accounts (
  id                  INT           NOT NULL AUTO_INCREMENT,
  username            VARCHAR(16)   NOT NULL,
  password_hash       VARCHAR(255)  NOT NULL,
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  email               VARCHAR(255),
  is_admin            TINYINT(1)    NOT NULL DEFAULT 0,
  email_verified      TINYINT(1)    NOT NULL DEFAULT 0,
  email_verify_token  VARCHAR(64),
  PRIMARY KEY (id),
  UNIQUE KEY uq_username (username),
  UNIQUE KEY uq_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE account_follows (
  follower_id   INT       NOT NULL,
  following_id  INT       NOT NULL,
  created_at    DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id),
  KEY idx_af_following (following_id),
  FOREIGN KEY (follower_id)  REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (following_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── PLAYER PROGRESS ──────────────────────────────────────────

CREATE TABLE player_progress (
  account_id       INT          NOT NULL,
  player_name      VARCHAR(16)  NOT NULL,
  current_world_id VARCHAR(8)   NOT NULL DEFAULT 'w1',
  wallet           INT          NOT NULL DEFAULT 412,
  has_save         TINYINT(1)   NOT NULL DEFAULT 0,
  playtime_sec     INT          NOT NULL DEFAULT 0,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id),
  FOREIGN KEY (account_id)       REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (current_world_id) REFERENCES worlds(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE player_party (
  account_id  INT          NOT NULL,
  slot        TINYINT      NOT NULL,
  hero_id     VARCHAR(32)  NOT NULL,
  PRIMARY KEY (account_id, slot),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (hero_id)    REFERENCES heroes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE player_unlocked_heroes (
  account_id  INT          NOT NULL,
  hero_id     VARCHAR(32)  NOT NULL,
  unlocked_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, hero_id),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (hero_id)    REFERENCES heroes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE player_worlds_unlocked (
  account_id  INT         NOT NULL,
  world_id    VARCHAR(8)  NOT NULL,
  unlocked_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, world_id),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (world_id)   REFERENCES worlds(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE player_clears (
  account_id  INT          NOT NULL,
  world_id    VARCHAR(8)   NOT NULL,
  node_id     VARCHAR(16)  NOT NULL,
  cleared_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, world_id, node_id),
  FOREIGN KEY (account_id)        REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (world_id, node_id) REFERENCES world_nodes(world_id, node_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE player_inventory (
  account_id  INT          NOT NULL,
  item_id     VARCHAR(32)  NOT NULL,
  quantity    SMALLINT     NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, item_id),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id)    REFERENCES items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── COMMUNITY MODS ───────────────────────────────────────────

CREATE TABLE community_mods (
  id           INT           NOT NULL AUTO_INCREMENT,
  author_id    INT           NOT NULL,
  title        VARCHAR(128)  NOT NULL,
  description  TEXT,
  intro_text   TEXT,
  version      VARCHAR(16)   NOT NULL DEFAULT '1.0',
  is_published TINYINT(1)    NOT NULL DEFAULT 0,
  play_count   INT           NOT NULL DEFAULT 0,
  rating_sum   INT           NOT NULL DEFAULT 0,
  rating_count INT           NOT NULL DEFAULT 0,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (author_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE mod_data (
  mod_id     INT         NOT NULL,
  data_json  MEDIUMTEXT  NOT NULL,
  PRIMARY KEY (mod_id),
  FOREIGN KEY (mod_id) REFERENCES community_mods(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE mod_ratings (
  mod_id      INT      NOT NULL,
  account_id  INT      NOT NULL,
  rating      TINYINT  NOT NULL,
  rated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (mod_id, account_id),
  FOREIGN KEY (mod_id)     REFERENCES community_mods(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── GLOBAL CONFIG ─────────────────────────────────────────────

CREATE TABLE game_settings (
  `key`      VARCHAR(100)  NOT NULL,
  value      MEDIUMTEXT    NOT NULL,
  updated_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                           ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO heroes VALUES
  ('CURSOR.EXE', 'POINTER',   'Legacy input device. Precise single-target striker; cheap on CPU.',              220, 60,  1.30, 22, 36, 'CLICKSTORM',           'rage-click() — 6 random hits'),
  ('GUARD.SYS',  'TANK',      'System sentinel. High HP. Heals, shields and pulls aggro.',                      410, 80,  0.95, 16, 26, 'PORT 22 LOCKDOWN',     'firewall_all() — block next round'),
  ('PURGE.BAT',  'PURIFIER',  'Antimalware shell. Heavy damage and brutal debuffs at high CPU cost.',           175, 100, 1.10, 26, 40, 'rm -rf /malware/*',    '999 dmg AoE — purge all'),
  ('PING.DLL',   'SCOUT',     'Network probe. Hits fast, exposes weaknesses, scrambles enemy timing.',          160, 70,  1.50, 18, 28, 'TRACEROUTE',           'reveal-all + multi-hit chain'),
  ('ROOT.SH',    'ADMIN',     'Privileged user. Versatile mix of damage, revive, and buffs.',                   280, 90,  1.00, 24, 38, 'sudo shutdown -h NOW', 'massive single-target nuke'),
  ('INDEX.LOG',  'ARCHIVIST', 'Keeper of logs. Specialist in debuffs and information warfare.',                  200, 85,  0.85, 20, 30, 'STACK TRACE',          'expose all — party hits crit');

INSERT INTO hero_scripts VALUES
  ('click',     'CURSOR.EXE', 'click()',          0,  28, 44,   0,   0, 'single', NULL,        'Sharp double-click on one target.'),
  ('drag',      'CURSOR.EXE', 'drag(target)',     8,  18, 30,   0,   0, 'single', 'knockback', 'Knock target back; -1 ATB.'),
  ('selectall', 'CURSOR.EXE', 'select_all()',     18, 14, 24,   0,   0, 'aoe',    NULL,        'Hits every active threat.'),
  ('inspect',   'CURSOR.EXE', 'inspect(elem)',    6,   0,  0,   0,   0, 'debuff', 'expose',    'Expose weakness — next hits crit.'),
  ('patch',     'GUARD.SYS',  'patch.dll(ally)',  8,   0,  0,  60,  90, 'heal',   NULL,        'Restore an ally''s INTEGRITY.'),
  ('shield',    'GUARD.SYS',  'shield_up(ally)',  10,  0,  0,   0,   0, 'buff',   'shield',    'Halve incoming damage on ally.'),
  ('reroute',   'GUARD.SYS',  'reroute(ally)',    6,   0,  0,   0,   0, 'buff',   'taunt',     'Pull all aggro to GUARD.SYS.'),
  ('backup',    'GUARD.SYS',  'backup.zip()',     24,  0,  0,  40,  55, 'aoehel', NULL,        'Heal the whole party.'),
  ('kill9',     'PURGE.BAT',  'kill -9 (target)', 10, 44, 72,   0,   0, 'single', NULL,        'Force-terminate a process.'),
  ('chmod000',  'PURGE.BAT',  'chmod 000(t)',     12,  0,  0,   0,   0, 'debuff', 'silence',   'Strip target privileges (skip turn).'),
  ('qrtn',      'PURGE.BAT',  'quarantine(t)',    14,  0,  0,   0,   0, 'debuff', 'freeze',    'Encase target — no actions for 2 ticks.'),
  ('sudormrf',  'PURGE.BAT',  'sudo rm -rf .',    28, 34, 52,   0,   0, 'aoe',    NULL,        'Wipe-attempt AoE on all enemies.'),
  ('ping',      'PING.DLL',   'ping(target)',     2,  14, 24,   0,   0, 'single', NULL,        'Quick packet — fast & cheap.'),
  ('tracert',   'PING.DLL',   'tracert()',        10, 10, 18,   0,   0, 'aoe',    NULL,        'Hit every enemy + map their weak ports.'),
  ('jitter',    'PING.DLL',   'jitter(target)',   6,   0,  0,   0,   0, 'debuff', 'freeze',    'Scramble target ATB (loses turn).'),
  ('wget',      'PING.DLL',   'wget(target)',     8,  20, 32,   0,   0, 'single', NULL,        'Yank packet — chance to steal an item.'),
  ('whoami',    'ROOT.SH',    'sudo whoami',      0,  26, 40,   0,   0, 'single', NULL,        'Identify-and-strike combo.'),
  ('grep',      'ROOT.SH',    'sudo grep(t)',     6,   0,  0,   0,   0, 'debuff', 'expose',    'Find exploit — next hit crits.'),
  ('restart',   'ROOT.SH',    'sudo restart(a)',  14,  0,  0, 100, 140, 'heal',   NULL,        'Revive a faulted ally with high HP.'),
  ('nice',      'ROOT.SH',    'sudo nice -20',    10,  0,  0,   0,   0, 'buff',   'haste',     'Boost an ally ATB rate.'),
  ('logwrite',  'INDEX.LOG',  'log.write()',      2,  16, 24,   0,   0, 'single', NULL,        'Append a damaging entry to target.'),
  ('audit',     'INDEX.LOG',  'audit.fail(t)',    6,   0,  0,   0,   0, 'debuff', 'expose',    'Force target to admit weakness.'),
  ('syslog',    'INDEX.LOG',  'syslog.flood',     12,  0,  0,   0,   0, 'debuff', 'silence',   'Drown all foes in noise — silence AoE.'),
  ('rotate',    'INDEX.LOG',  'log.rotate(t)',    8,  28, 42,   0,   0, 'single', NULL,        'Recursive overwrite — heavy hit.');

INSERT INTO items VALUES
  ('patch',     'patch.dll',         'heal',   80,  60,  30, 12, '+',  'HEAL',   'Restore 80 INTEGRITY to one ally.'),
  ('buffer',    'buffer.zip',        'mp',     40,  50,  25,  8, '~',  'CPU',    'Restore 40 CPU% to one ally.'),
  ('restore',   'restore_point.bak', 'revive', 120, 200, 100, 3, '↺',  'REVIVE', 'Revive one ally at 120 HP.'),
  ('rootkit',   '~/root.kit',        'bomb',   140, 180,  90, 4, '!',  'BOMB',   'Inverted exploit — 140 dmg to one foe.'),
  ('firewall',  'firewall.conf',     'heal',    50,  90,  45, 6, '■',  'SHIELD', 'Shield an ally for 2 hits.'),
  ('defrag',    'defrag.exe',        'mp',      80, 120,  60, 4, '▣',  'CPU',    'Restore 80 CPU% to one ally.'),
  ('exploit',   'exploit.sh',        'bomb',   200, 320, 160, 2, '▲',  'BOMB',   'Root exploit — 200 dmg, ignores shield.'),
  ('antidote',  'antidote.bat',      'heal',     0,  75,  38, 5, '✦',  'CURE',   'Cure all debuffs on one ally.'),
  ('jpegofkey', 'jpeg_of_key.jpg',   'heal',   200, 500, 250, 1, '★',  'MEGA',   'Legendary recovery — 200 HP and clear debuffs.');

INSERT INTO enemies VALUES
  ('POPUP.IMP',     '001', 'NUISANCE', 'POPUP MOOR',    'A loose dialog window with teeth. Annoying but fragile.',              80,  1.00, 12, 22,  8),
  ('TRACKER.SLIME', '002', 'COOKIE',   'COOKIE WOODS',  'A semi-sentient tracking cookie. Splits when stomped.',                90,  0.90, 10, 18, 10),
  ('CACHE.GHOUL',   '003', 'SPECTER',  'TEMP CAVES',    'Fossilized cache entry that refuses to expire.',                      120,  0.85, 14, 26, 14),
  ('PHISH.WYRM',    '004', 'LURE',     'PROXY PASS',    'Disguises itself as a legitimate form. Hits all targets on detect.',  160,  1.10, 18, 32, 20),
  ('KEYLOG.RAT',    '005', 'SPY',      'MINIBOSS',      'Watches keystrokes. Attacks when you least expect it.',               280,  1.20, 20, 34, 35),
  ('RANSOM.LARVA',  '006', 'CRYPTO',   'SECTOR FALLS',  'Encrypts processes one by one. Has a healing phase.',                 140,  1.00, 22, 38, 18),
  ('TROJAN.WORM',   '007', 'BOSS',     'CORE CHAMBER',  'The root threat. Corrupts sectors and spawns minions.',               900,  0.80, 32, 52, 120);

INSERT INTO worlds VALUES
  ('w1', 'SECTOR 1 / DESKTOP', 'system drive · workstation surface'),
  ('w2', 'SECTOR 2 / KERNEL',  'ring-0 · kernel space — they fight back'),
  ('w3', 'SECTOR 3 / CLOUD',   'distributed · load-balanced infestation');

INSERT INTO world_nodes VALUES
  ('start', 'w1', 'save',  '/HOME',                'AUTO-SAVE POINT',          70,  300, NULL,           NULL, 0),
  ('n1',    'w1', 'fight', '1-1  POPUP MOOR',      'POPUP.IMP x3',            170,  280, 'POPUP MOOR',      1, 0),
  ('n2',    'w1', 'fight', '1-2  COOKIE WOODS',    'TRACKER.SLIME x4',        270,  240, 'COOKIE WOODS',    2, 0),
  ('shop',  'w1', 'shop',  'REGISTRY MARKET',      'BUY/SELL DRIVERS',        340,  140, NULL,           NULL, 0),
  ('n3',    'w1', 'fight', '1-3  TEMP CAVES',      'CACHE.GHOUL x2 + POPUP',  380,  300, 'TEMP CAVES',      2, 0),
  ('mid',   'w1', 'mini',  'MINIBOSS KEYLOG.RAT',  'WATCHES YOUR INPUT',      490,  240, 'TEMP CAVES',      3, 0),
  ('n4',    'w1', 'fight', '1-4  PROXY PASS',      'PHISH.WYRM x1 + slimes',  600,  160, 'PROXY PASS',      3, 0),
  ('n5',    'w1', 'fight', '1-5  SECTOR FALLS',    'RANSOM.LARVA x3',         620,  330, 'SECTOR FALLS',    4, 0),
  ('save2', 'w1', 'save',  '/SAVE',                'SAFE SECTOR',             730,  240, NULL,           NULL, 0),
  ('boss',  'w1', 'boss',  'BOSS TROJAN.WORM',     'CORRUPTS ALL SECTORS',    880,  240, 'CORE CHAMBER',    4, 1),
  ('start', 'w2', 'save',  '/MNT/KERNEL',          'CHECKPOINT — ring 0',      70,  240, NULL,           NULL, 0),
  ('n1',    'w2', 'fight', '2-1  /VAR/LOG',        'PHISH.WYRM + slimes',     180,  260, 'PROXY PASS',      3, 0),
  ('n2',    'w2', 'fight', '2-2  PROC TABLE',      'CACHE.GHOUL x4',          290,  160, 'TEMP CAVES',      3, 0),
  ('shop',  'w2', 'shop',  'REGISTRY MARKET',      'KERNEL DRIVERS',          380,  330, NULL,           NULL, 0),
  ('n3',    'w2', 'fight', '2-3  IRQ FIELDS',      'KEYLOG.RAT x2 + popups',  430,  180, 'COOKIE WOODS',    4, 0),
  ('mid',   'w2', 'mini',  'MINIBOSS PHISH.WYRM',  'EVOLVED — sysadmin lure', 540,  240, 'PROXY PASS',      4, 0),
  ('n4',    'w2', 'fight', '2-4  ENCRYPTED LAKE',  'RANSOM.LARVA x4',         650,  140, 'SECTOR FALLS',    4, 0),
  ('n5',    'w2', 'fight', '2-5  GHOST POOL',      'CACHE.GHOUL x3 + ransom', 660,  330, 'TEMP CAVES',      5, 0),
  ('save2', 'w2', 'save',  '/SAVE',                'SAFE — pre-fault snap',   770,  240, NULL,           NULL, 0),
  ('boss',  'w2', 'boss',  'BOSS TROJAN.WORM v2',  'KERNEL-MODE INFILTRATOR', 900,  240, 'CORE CHAMBER',    5, 1),
  ('start', 'w3', 'save',  '/AVAIL-ZONE-A',        'CHECKPOINT — us-east',     70,  260, NULL,           NULL, 0),
  ('n1',    'w3', 'fight', '3-1  EDGE NODE',       'KEYLOG.RAT x3',           180,  160, 'PROXY PASS',      5, 0),
  ('n2',    'w3', 'fight', '3-2  BLOB STORE',      'TRACKER.SLIME x5',        200,  340, 'COOKIE WOODS',    5, 0),
  ('shop',  'w3', 'shop',  'REGISTRY MARKET',      'PREMIUM DRIVERS',         330,  240, NULL,           NULL, 0),
  ('n3',    'w3', 'fight', '3-3  LOAD BALANCER',   'PHISH.WYRM x2 + ghouls',  440,  140, 'PROXY PASS',      5, 0),
  ('mid',   'w3', 'mini',  'MINIBOSS RANSOM.HIVE', 'COLONY of RANSOM.LARVA',  520,  300, 'SECTOR FALLS',    6, 0),
  ('n4',    'w3', 'fight', '3-4  SHARD GRAVEYARD', 'CACHE.GHOUL x4 + phish',  640,  160, 'TEMP CAVES',      6, 0),
  ('n5',    'w3', 'fight', '3-5  ENCRYPT STORM',   'RANSOM x2 + KEYLOG x2',   660,  340, 'SECTOR FALLS',    7, 0),
  ('save2', 'w3', 'save',  '/SAVE',                'LAST CHECKPOINT',         780,  240, NULL,           NULL, 0),
  ('boss',  'w3', 'boss',  'BOSS TROJAN.MULTI',    'SHARDED ROOT WORM',       910,  240, 'CORE CHAMBER',    6, 1);

INSERT INTO node_enemies VALUES
  ('w1','n1',  0,'POPUP.IMP'),    ('w1','n1',  1,'POPUP.IMP'),    ('w1','n1',  2,'POPUP.IMP'),
  ('w1','n2',  0,'TRACKER.SLIME'),('w1','n2',  1,'TRACKER.SLIME'),('w1','n2',  2,'TRACKER.SLIME'),('w1','n2',3,'TRACKER.SLIME'),
  ('w1','n3',  0,'CACHE.GHOUL'), ('w1','n3',  1,'CACHE.GHOUL'), ('w1','n3',  2,'POPUP.IMP'),
  ('w1','mid', 0,'KEYLOG.RAT'),  ('w1','mid', 1,'POPUP.IMP'),   ('w1','mid', 2,'POPUP.IMP'),
  ('w1','n4',  0,'PHISH.WYRM'),  ('w1','n4',  1,'TRACKER.SLIME'),('w1','n4',  2,'TRACKER.SLIME'),
  ('w1','n5',  0,'RANSOM.LARVA'),('w1','n5',  1,'RANSOM.LARVA'),('w1','n5',  2,'RANSOM.LARVA'),
  ('w1','boss',0,'TROJAN.WORM'),
  ('w2','n1',  0,'PHISH.WYRM'),  ('w2','n1',  1,'TRACKER.SLIME'),('w2','n1',  2,'TRACKER.SLIME'),('w2','n1',3,'TRACKER.SLIME'),
  ('w2','n2',  0,'CACHE.GHOUL'), ('w2','n2',  1,'CACHE.GHOUL'), ('w2','n2',  2,'CACHE.GHOUL'), ('w2','n2',3,'CACHE.GHOUL'),
  ('w2','n3',  0,'KEYLOG.RAT'),  ('w2','n3',  1,'KEYLOG.RAT'),  ('w2','n3',  2,'POPUP.IMP'),   ('w2','n3',3,'POPUP.IMP'),
  ('w2','mid', 0,'PHISH.WYRM'),  ('w2','mid', 1,'PHISH.WYRM'),  ('w2','mid', 2,'TRACKER.SLIME'),
  ('w2','n4',  0,'RANSOM.LARVA'),('w2','n4',  1,'RANSOM.LARVA'),('w2','n4',  2,'RANSOM.LARVA'),('w2','n4',3,'RANSOM.LARVA'),
  ('w2','n5',  0,'CACHE.GHOUL'), ('w2','n5',  1,'CACHE.GHOUL'), ('w2','n5',  2,'CACHE.GHOUL'), ('w2','n5',3,'RANSOM.LARVA'),
  ('w2','boss',0,'TROJAN.WORM'),
  ('w3','n1',  0,'KEYLOG.RAT'),  ('w3','n1',  1,'KEYLOG.RAT'),  ('w3','n1',  2,'KEYLOG.RAT'),
  ('w3','n2',  0,'TRACKER.SLIME'),('w3','n2', 1,'TRACKER.SLIME'),('w3','n2', 2,'TRACKER.SLIME'),('w3','n2',3,'TRACKER.SLIME'),('w3','n2',4,'TRACKER.SLIME'),
  ('w3','n3',  0,'PHISH.WYRM'),  ('w3','n3',  1,'PHISH.WYRM'),  ('w3','n3',  2,'CACHE.GHOUL'), ('w3','n3',3,'CACHE.GHOUL'),
  ('w3','mid', 0,'RANSOM.LARVA'),('w3','mid', 1,'RANSOM.LARVA'),('w3','mid', 2,'RANSOM.LARVA'),('w3','mid',3,'RANSOM.LARVA'),
  ('w3','n4',  0,'CACHE.GHOUL'), ('w3','n4',  1,'CACHE.GHOUL'), ('w3','n4',  2,'CACHE.GHOUL'), ('w3','n4',3,'CACHE.GHOUL'),('w3','n4',4,'PHISH.WYRM'),
  ('w3','n5',  0,'RANSOM.LARVA'),('w3','n5',  1,'RANSOM.LARVA'),('w3','n5',  2,'KEYLOG.RAT'),  ('w3','n5',3,'KEYLOG.RAT'),
  ('w3','boss',0,'TROJAN.WORM');

INSERT INTO world_edges VALUES
  ('w1','start','n1'),  ('w1','n1','n2'),    ('w1','n2','shop'),  ('w1','n2','n3'),
  ('w1','n3','mid'),    ('w1','shop','mid'), ('w1','mid','n4'),   ('w1','mid','n5'),
  ('w1','n4','save2'),  ('w1','n5','save2'), ('w1','save2','boss'),
  ('w2','start','n1'),  ('w2','n1','n2'),    ('w2','n1','shop'),  ('w2','n2','n3'),
  ('w2','shop','n3'),   ('w2','n3','mid'),   ('w2','mid','n4'),   ('w2','mid','n5'),
  ('w2','n4','save2'),  ('w2','n5','save2'), ('w2','save2','boss'),
  ('w3','start','n1'),  ('w3','start','n2'), ('w3','n1','shop'),  ('w3','n2','shop'),
  ('w3','shop','n3'),   ('w3','shop','mid'), ('w3','n3','mid'),   ('w3','mid','n4'),
  ('w3','mid','n5'),    ('w3','n4','save2'), ('w3','n5','save2'), ('w3','save2','boss');

INSERT INTO game_settings VALUES ('sprite_overrides','{\"heroes\":{\"CURSOR.EXE\":{\"grid\":[\"..aa............\",\"..aka...........\",\"..akka..........\",\"..akkka.........\",\"..akkkka........\",\"..akkkkka.......\",\"..akkkakka......\",\"..akkkkkkka.....\",\"..akakkakkka....\",\"..akkkaakka.....\",\"..akkkkkka......\",\"..akkkaakka.....\",\"..akka..akaa....\",\"...aa....a..a...\",\".......aaa..aa..\",\"......a......a..\",\"......a......a..\",\"....aaa.....aa..\"],\"body\":\"#2a3a55\",\"rim\":\"#a5b985\",\"dark\":\"#020806\",\"acc\":\"#fefae0\",\"eye\":\"#fefae0\",\"role\":\"POINTER\",\"bio\":\"Legacy input device. Precise single-target striker; cheap on CPU.\",\"hpMax\":220,\"cpuMax\":60,\"spd\":1.3,\"atk\":[22,36],\"limitName\":\"CLICKSTORM\",\"limitDesc\":\"rage-click() — 6 random hits\",\"scripts\":[{\"id\":\"click\",\"label\":\"click()\",\"cost\":0,\"dmg\":[28,44],\"kind\":\"single\",\"desc\":\"Sharp double-click on one target.\"},{\"id\":\"drag\",\"label\":\"drag(target)\",\"cost\":8,\"dmg\":[18,30],\"kind\":\"single\",\"extra\":\"knockback\",\"desc\":\"Knock target back; -1 ATB.\"},{\"id\":\"selectall\",\"label\":\"select_all()\",\"cost\":18,\"dmg\":[14,24],\"kind\":\"aoe\",\"desc\":\"Hits every active threat.\"},{\"id\":\"inspect\",\"label\":\"inspect(elem)\",\"cost\":6,\"dmg\":[0,0],\"kind\":\"debuff\",\"extra\":\"expose\",\"desc\":\"Expose weakness — next hits crit.\"}]},\"GUARD.SYS\":{\"grid\":[\"......####......\",\".....######.....\",\"....#e#e#e##....\",\"k...#e#e#e##...k\",\"kkk.########.kkk\",\"kaakkkkkkkkkkaak\",\"kraaaaakaaaaaaak\",\"kraaaaakaaaaaakk\",\"krkaaaakaaakaaak\",\"kaaaaaakaakaaaak\",\"kaaaaaakaaaaaaak\",\"##aakaakaaaaaa##\",\"##aaaaakaaaaak##\",\"##kaaaakaakaak##\",\"...kaaakaaaak...\",\"....kaakaaak....\",\"....#kakaak#....\",\"...###kkkk###...\"],\"body\":\"#3a3a18\",\"rim\":\"#d4f4a3\",\"dark\":\"#020806\",\"acc\":\"#fefae0\",\"eye\":\"#fefae0\",\"role\":\"TANK\",\"bio\":\"System sentinel. High HP. Heals, shields and pulls aggro.\",\"hpMax\":410,\"cpuMax\":80,\"spd\":0.95,\"atk\":[16,26],\"limitName\":\"PORT 22 LOCKDOWN\",\"limitDesc\":\"firewall_all() — block next round\",\"scripts\":[{\"id\":\"patch\",\"label\":\"patch.dll(ally)\",\"cost\":8,\"heal\":[60,90],\"kind\":\"heal\",\"desc\":\"Restore an ally\'s INTEGRITY.\"},{\"id\":\"shield\",\"label\":\"shield_up(ally)\",\"cost\":10,\"kind\":\"buff\",\"extra\":\"shield\",\"desc\":\"Halve incoming damage on ally.\"},{\"id\":\"reroute\",\"label\":\"reroute(ally)\",\"cost\":6,\"kind\":\"buff\",\"extra\":\"taunt\",\"desc\":\"Pull all aggro to GUARD.SYS.\"},{\"id\":\"backup\",\"label\":\"backup.zip()\",\"cost\":24,\"heal\":[40,55],\"kind\":\"aoehel\",\"desc\":\"Heal the whole party.\"}]},\"PURGE.BAT\":{\"grid\":[\"................\",\"................\",\".........r......\",\"........rr......\",\".......r##r.....\",\".......r#er.....\",\"......r####r....\",\"......r#e##r....\",\".e...r#e####r...\",\"eee..r####e#r...\",\".e..rrrrrrrrrr..\",\".a....kekekk....\",\".a....######....\",\".aa####rrrr##...\",\"..arrrrrrrrr#...\",\"..a###rrrrrr#...\",\"..a..#r###rr#...\",\"..a.###...###...\"],\"body\":\"#1a0a2a\",\"rim\":\"#4d2376\",\"dark\":\"#000000\",\"acc\":\"#8a6438\",\"eye\":\"#ffd270\",\"role\":\"PURIFIER\",\"bio\":\"Antimalware shell. Heavy damage and brutal debuffs at high CPU cost.\",\"hpMax\":175,\"cpuMax\":100,\"spd\":1.1,\"atk\":[26,40],\"limitName\":\"rm -rf /malware/*\",\"limitDesc\":\"999 dmg AoE — purge all\",\"scripts\":[{\"id\":\"kill9\",\"label\":\"kill -9 (target)\",\"cost\":10,\"dmg\":[44,72],\"kind\":\"single\",\"desc\":\"Force-terminate a process.\"},{\"id\":\"chmod000\",\"label\":\"chmod 000(t)\",\"cost\":12,\"kind\":\"debuff\",\"extra\":\"silence\",\"desc\":\"Strip target\'s privileges (skip turn).\"},{\"id\":\"qrtn\",\"label\":\"quarantine(t)\",\"cost\":14,\"kind\":\"debuff\",\"extra\":\"freeze\",\"desc\":\"Encase target — no actions for 2 ticks.\"},{\"id\":\"sudormrf\",\"label\":\"sudo rm -rf .\",\"cost\":28,\"dmg\":[34,52],\"kind\":\"aoe\",\"desc\":\"Wipe-attempt AoE on all enemies.\"}]},\"PING.DLL\":{\"grid\":[\"................\",\"................\",\"................\",\"....####........\",\"...#rrr##.......\",\"...#reer#.......\",\"...#rerr#aaa....\",\"...#rrrkr#a.....\",\"...#rrkkrr#...a.\",\"...#rrrrkr##..aa\",\"....#rrkkrrr###.\",\"....#rrrrrrrr##.\",\".....#rrrrr###..\",\"......#####.....\",\"......#...#.....\",\"......a...a.....\",\"......a...a.....\",\".....aa..aa.....\"],\"body\":\"#1a3a55\",\"rim\":\"#88abdd\",\"dark\":\"#020816\",\"acc\":\"#2b41b1\",\"eye\":\"#ffdc4a\",\"role\":\"SCOUT\",\"bio\":\"Network probe. Hits fast, exposes weaknesses, scrambles enemy timing.\",\"hpMax\":160,\"cpuMax\":70,\"spd\":1.5,\"atk\":[18,28],\"limitName\":\"TRACEROUTE\",\"limitDesc\":\"reveal-all + multi-hit chain\",\"scripts\":[{\"id\":\"ping\",\"label\":\"ping(target)\",\"cost\":2,\"dmg\":[14,24],\"kind\":\"single\",\"desc\":\"Quick packet — fast & cheap.\"},{\"id\":\"tracert\",\"label\":\"tracert()\",\"cost\":10,\"dmg\":[10,18],\"kind\":\"aoe\",\"desc\":\"Hit every enemy + map their weak ports.\"},{\"id\":\"jitter\",\"label\":\"jitter(target)\",\"cost\":6,\"kind\":\"debuff\",\"extra\":\"freeze\",\"desc\":\"Scramble target\'s ATB (loses turn).\"},{\"id\":\"wget\",\"label\":\"wget(target)\",\"cost\":8,\"dmg\":[20,32],\"kind\":\"single\",\"desc\":\"Yank packet — chance to steal an item.\"}]},\"ROOT.SH\":{\"grid\":[\".......aa.......\",\".....r.aa.r.....\",\".....aaaaaa.....\",\".....######.....\",\"....##e##e##....\",\"....##e##e##....\",\"....#k####k#....\",\"....##kkkk##....\",\"..aa.######.aa..\",\".aa##########aa.\",\".aa##rr##rr##aa.\",\".aa##r####r##aa.\",\"..aa########aa..\",\"....##....##....\",\"....##....##....\",\"....rr....rr....\",\"....rr....rr....\",\"...rrr....rrr...\"],\"body\":\"#3a0a1a\",\"rim\":\"#ffdc4a\",\"dark\":\"#020806\",\"acc\":\"#ffdc4a\",\"eye\":\"#fefae0\",\"role\":\"ADMIN\",\"bio\":\"Privileged user. Versatile mix of damage, revive, and buffs.\",\"hpMax\":280,\"cpuMax\":90,\"spd\":1,\"atk\":[24,38],\"limitName\":\"sudo shutdown -h NOW\",\"limitDesc\":\"massive single-target nuke\",\"scripts\":[{\"id\":\"whoami\",\"label\":\"sudo whoami\",\"cost\":0,\"dmg\":[26,40],\"kind\":\"single\",\"desc\":\"Identify-and-strike combo.\"},{\"id\":\"grep\",\"label\":\"sudo grep(t)\",\"cost\":6,\"kind\":\"debuff\",\"extra\":\"expose\",\"desc\":\"Find target\'s exploit — next hit crits.\"},{\"id\":\"restart\",\"label\":\"sudo restart(a)\",\"cost\":14,\"heal\":[100,140],\"kind\":\"heal\",\"desc\":\"Revive a faulted ally with high HP.\"},{\"id\":\"nice\",\"label\":\"sudo nice -20\",\"cost\":10,\"kind\":\"buff\",\"extra\":\"haste\",\"desc\":\"Boost an ally\'s ATB rate.\"}]},\"INDEX.LOG\":{\"grid\":[\"................\",\"................\",\"................\",\".....rrrrrrr....\",\"....r######r....\",\"....ree#ee#r....\",\"....r#######r...\",\"....r#rrr##rr...\",\"....rr###rrr....\",\".....rrrraaar...\",\"......rrrrrar...\",\"......rkkkraar..\",\"......rkk##aar..\",\"......rkkkraar..\",\"......rrrrraaar.\",\".......raaaaaar.\",\".......raaaaaar.\",\".......rrrrrrrr.\"],\"body\":\"#3a2a18\",\"rim\":\"#ffffff\",\"dark\":\"#020806\",\"acc\":\"#7d2212\",\"eye\":\"#a5e58a\",\"role\":\"ARCHIVIST\",\"bio\":\"Keeper of logs. Specialist in debuffs and information warfare.\",\"hpMax\":200,\"cpuMax\":85,\"spd\":0.85,\"atk\":[20,30],\"limitName\":\"STACK TRACE\",\"limitDesc\":\"expose all — party hits crit\",\"scripts\":[{\"id\":\"logwrite\",\"label\":\"log.write()\",\"cost\":2,\"dmg\":[16,24],\"kind\":\"single\",\"desc\":\"Append a damaging entry to target.\"},{\"id\":\"audit\",\"label\":\"audit.fail(t)\",\"cost\":6,\"kind\":\"debuff\",\"extra\":\"expose\",\"desc\":\"Force target to admit weakness.\"},{\"id\":\"syslog\",\"label\":\"syslog.flood\",\"cost\":12,\"kind\":\"debuff\",\"extra\":\"silence\",\"desc\":\"Drown all foes in noise — silence AoE.\"},{\"id\":\"rotate\",\"label\":\"log.rotate(t)\",\"cost\":8,\"dmg\":[28,42],\"kind\":\"single\",\"desc\":\"Recursive overwrite — heavy hit.\"}]}},\"enemies\":{\"POPUP.IMP\":{\"grid\":[\"................\",\"................\",\"................\",\"................\",\"................\",\"...#........#...\",\"...##......##...\",\"....########....\",\"#...#kkkkkk#....\",\"##..#kekkke#....\",\"#...#keekee#....\",\"#...#kkkkkk#....\",\"############....\",\"....#......#....\",\"....#......#....\",\"...#.#....#.#...\",\"................\",\"................\"],\"body\":\"#c96969\",\"rim\":\"#fefae0\",\"dark\":\"#591818\",\"acc\":\"#d39b3c\",\"eye\":\"#d26c2d\",\"hp\":60,\"dmg\":[8,14],\"spd\":1.4,\"xp\":12,\"attacks\":[{\"id\":\"ax1sp\",\"name\":\"UNSKIPPABLE.AD()\",\"kind\":\"single\",\"dmg\":[10,16]}]},\"TRACKER.SLIME\":{\"grid\":[\"................\",\"................\",\"................\",\"....########....\",\"..###k####k###..\",\".########k####k.\",\".####r####r####.\",\".#k##rr##rr####.\",\".##############.\",\".###rrrrrrrr#k#.\",\".#k#r######r###.\",\"..####k##k####..\",\"...####k#####...\",\"....########....\",\".....kkkkkk.....\",\"................\",\"................\",\"................\"],\"body\":\"#b07840\",\"rim\":\"#fff1cf\",\"dark\":\"#3a200a\",\"acc\":\"#9a3a3a\",\"eye\":\"#1a0a00\",\"hp\":80,\"dmg\":[10,16],\"spd\":1,\"xp\":18,\"attacks\":[{\"id\":\"ax0od\",\"name\":\"FORCED.COOKIES()\",\"kind\":\"single\",\"dmg\":[10,16]}]},\"CACHE.GHOUL\":{\"grid\":[\"..#.............\",\".....######...#.\",\"....########..#.\",\"#..###e##e###...\",\"#..###e##e#.#...\",\"#..########.#...\",\"...##########...\",\"...#.#r##r###...\",\"...###rrrr###...\",\"...#.########...\",\"...#..####..#...\",\"...##.###..##...\",\"...##########...\",\"...#k#k#k#k#...\",\"...#.#.#.#.#...\",\"...#...#...#...\",\".#...#..........\",\".#.........#....\"],\"body\":\"#9bc4ff\",\"rim\":\"#e6f1ff\",\"dark\":\"#13294a\",\"acc\":\"#ff6ec7\",\"eye\":\"#3a1a4a\",\"hp\":90,\"dmg\":[12,22],\"spd\":0.9,\"xp\":22,\"attacks\":[{\"id\":\"axgjd\",\"name\":\"PHANTOM.PAIN()\",\"kind\":\"single\",\"dmg\":[10,16]},{\"id\":\"axl2i\",\"name\":\"LAG.BOMB()\",\"kind\":\"aoe\",\"dmg\":[10,16]}]},\"KEYLOG.RAT\":{\"grid\":[\"................\",\".aa......aa.....\",\"ae#a....a#ea....\",\"a#ea....ae#a....\",\"ae#a....a#ea....\",\".aa##aa##aa.....\",\"..########......\",\".####aa####aaaa.\",\".###aeaa###aaaa.\",\".###aeea#kk#####\",\".####aa####kkkk#\",\"..########...a.a\",\"...######.......\",\"...#....#.......\",\"...#....#.......\",\"..###..###......\",\"...#....#.......\",\"................\"],\"body\":\"#7a6a55\",\"rim\":\"#cfb38a\",\"dark\":\"#1a120a\",\"acc\":\"#fefae0\",\"eye\":\"#ff3a3a\",\"hp\":180,\"dmg\":[18,28],\"spd\":1.3,\"xp\":60,\"attacks\":[{\"id\":\"axuj2\",\"name\":\"KEY.STAB()\",\"kind\":\"single\",\"dmg\":[10,16]},{\"id\":\"axxju\",\"name\":\"STEAL.YOUR.PWORD()\",\"kind\":\"aoe\",\"dmg\":[10,16]},{\"id\":\"axbsl\",\"name\":\"CONSUME.KEY()\",\"kind\":\"heal\",\"heal\":[30,50]}]},\"PHISH.WYRM\":{\"grid\":[\".aaa............\",\"aaaa............\",\".aa.............\",\"..aa....####....\",\"..a#####rrrrr#..\",\"..#rrrrr####ee..\",\".#r#kkkkk#####..\",\"#r#k....k###rrr#\",\"##k......kkkrkkk\",\"#k..........r...\",\"##..............\",\"##..............\",\"#r#...........r.\",\"##r#.........rr.\",\"k##r#.......##..\",\".kk#r#.....##k..\",\"...k#r#####kk...\",\"....kkkkkkk.....\"],\"body\":\"#3a8a5b\",\"rim\":\"#a5e58a\",\"dark\":\"#0a2a18\",\"acc\":\"#d4a373\",\"eye\":\"#ffdc4a\",\"hp\":220,\"dmg\":[22,36],\"spd\":0.7,\"xp\":80,\"attacks\":[{\"id\":\"ax988\",\"name\":\"TAIL.WHIP()\",\"kind\":\"single\",\"dmg\":[10,16]},{\"id\":\"axxq8\",\"name\":\"TAIL.SWEEP()\",\"kind\":\"aoe\",\"dmg\":[10,21]},{\"id\":\"ax6le\",\"name\":\"SCALE.COAT()\",\"kind\":\"shield\"}]},\"RANSOM.LARVA\":{\"grid\":[\".....a....a.....\",\".....######.....\",\"....#a####a#....\",\"...##aa##aa##...\",\"...##########...\",\"...####aa####...\",\"...##########...\",\"...####aa####...\",\".aa###aaaa###aa.\",\"...##aaaaaa##...\",\".aa##a####a##aa.\",\"...##a#kk#a##...\",\"...##a####a##...\",\".aa##aaaaaa##aa.\",\"...k########k...\",\"....k######k....\",\".....kkkkkk.....\",\"................\"],\"body\":\"#7a4a8a\",\"rim\":\"#d4a3e5\",\"dark\":\"#1a0a2a\",\"acc\":\"#ffdc4a\",\"eye\":\"#1a0a00\",\"hp\":140,\"dmg\":[16,26],\"spd\":1,\"xp\":44,\"attacks\":[{\"id\":\"axd4o\",\"name\":\"SMOL.BITE()\",\"kind\":\"single\",\"dmg\":[10,16]},{\"id\":\"axcgh\",\"name\":\"HARDEN()\",\"kind\":\"shield\"},{\"id\":\"axdpt\",\"name\":\"HIVE.MIND()\",\"kind\":\"heal\",\"heal\":[30,50]}]},\"TROJAN.WORM\":{\"grid\":[\"aaaaa...rr..aaaa\",\"#a.......r....a#\",\"##aaaa...r.aaa##\",\"###aa...rr..a###\",\"#####a..r..a####\",\"###e##a.r.aa####\",\"rreerr#ara#rrrrr\",\"#eee####a#######\",\"################\",\"kkkkkkkkkkkkkkkk\",\"######rrrrrr####\",\"################\",\"################\",\"rrrrrrrrrrrrrrrr\",\"################\",\"################\",\"kkkkkkkkkkkkkkkk\",\"################\"],\"body\":\"#563c20\",\"rim\":\"#d4a373\",\"dark\":\"#1a0a00\",\"acc\":\"#9a1a1a\",\"eye\":\"#ffdc4a\",\"hp\":380,\"dmg\":[18,30],\"spd\":0.55,\"xp\":400,\"attacks\":[{\"id\":\"axd0p\",\"name\":\"ENGULF()\",\"kind\":\"aoe\",\"dmg\":[20,30]},{\"id\":\"ax8lx\",\"name\":\"HARDEN.V2()\",\"kind\":\"buff\"},{\"id\":\"axy9k\",\"name\":\"CHOMP()\",\"kind\":\"single\",\"dmg\":[16,30]}]}}}',NOW());
