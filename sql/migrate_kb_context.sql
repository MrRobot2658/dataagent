-- 知识库「LLM 上下文策展」：为 kb_files 增加 token 估算与是否纳入上下文两列，并灌入分域多模态演示数据。
-- 卡帕西 LLM 知识库模式：上下文=RAM、文件=磁盘；分域文件夹承载多模态资料，文档为主干，可策展进上下文。
USE dataagent;

-- ── 列（幂等：information_schema 检查 + 动态 DDL）──────────────────────────────
SET @ddl := IF(
  NOT EXISTS(SELECT 1 FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = 'kb_files' AND column_name = 'token_estimate'),
  'ALTER TABLE kb_files ADD COLUMN token_estimate INT NOT NULL DEFAULT 0 COMMENT ''LLM 上下文 token 估算''',
  'SELECT 1');
PREPARE _s FROM @ddl; EXECUTE _s; DEALLOCATE PREPARE _s;

SET @ddl := IF(
  NOT EXISTS(SELECT 1 FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = 'kb_files' AND column_name = 'in_context'),
  'ALTER TABLE kb_files ADD COLUMN in_context TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''是否策展进 LLM 上下文''',
  'SELECT 1');
PREPARE _s FROM @ddl; EXECUTE _s; DEALLOCATE PREPARE _s;

-- ── 分域多模态演示数据（INSERT IGNORE 幂等；storage_path 留空，仅供展示/策展）──
INSERT IGNORE INTO kb_files
  (id, tenant_id, name, folder, mime_type, kind, size_bytes, storage_path, description, token_estimate, in_context) VALUES
 ('kb_seed_p1',1001,'Quasar 产品手册.md','/产品知识','text/markdown','document',12700,NULL,'产品总体说明',4200,0),
 ('kb_seed_p2',1001,'定价与套餐.md','/产品知识','text/markdown','document',3100,NULL,'套餐与计费',1100,0),
 ('kb_seed_p3',1001,'控制台功能演示.mp4','/产品知识','video/mp4','video',86200000,NULL,'4分12秒演示',1800,0),
 ('kb_seed_p4',1001,'架构图.png','/产品知识','image/png','image',540000,NULL,'数据链路架构',320,0),
 ('kb_seed_m1',1001,'核心指标口径.md','/指标口径','text/markdown','document',8700,NULL,'语义层口径定义',3000,1),
 ('kb_seed_m2',1001,'退款率定义.md','/指标口径','text/markdown','document',1400,NULL,'退款率口径',520,1),
 ('kb_seed_m3',1001,'GMV 计算规则.md','/指标口径','text/markdown','document',2000,NULL,'GMV 口径',720,1),
 ('kb_seed_q1',1001,'B202603 质检报告.pdf','/质检与供应链','application/pdf','document',420000,NULL,'批次质检（色泽不均）',2600,1),
 ('kb_seed_q2',1001,'色泽不均-样品.jpg','/质检与供应链','image/jpeg','image',3600000,NULL,'样品照片',280,0),
 ('kb_seed_q3',1001,'产线巡检.mp4','/质检与供应链','video/mp4','video',172000000,NULL,'8分36秒巡检',2400,0),
 ('kb_seed_q4',1001,'供应商A 档案.md','/质检与供应链','text/markdown','document',4200,NULL,'供应商质量趋势',1500,1),
 ('kb_seed_a1',1001,'客户A 主合同.pdf','/客户档案','application/pdf','document',980000,NULL,'14页主合同',5200,0),
 ('kb_seed_a2',1001,'客服通话-2026Q2.mp3','/客户档案','audio/mpeg','audio',22300000,NULL,'23分09秒通话',3400,0),
 ('kb_seed_a3',1001,'拜访纪要.md','/客户档案','text/markdown','document',2600,NULL,'拜访记录',950,0),
 ('kb_seed_a4',1001,'对账明细.csv','/客户档案','text/csv','document',1260000,NULL,'对账数据',600,0),
 ('kb_seed_s1',1001,'圈人 SOP.md','/运营SOP','text/markdown','document',5000,NULL,'圈人标准流程',1800,1),
 ('kb_seed_s2',1001,'看板搭建规范.md','/运营SOP','text/markdown','document',3300,NULL,'看板规范',1200,0),
 ('kb_seed_s3',1001,'数据接入清单.md','/运营SOP','text/markdown','document',1900,NULL,'接入清单',680,0),
 ('kb_seed_t1',1001,'新人培训-第1讲.mp4','/培训素材','video/mp4','video',628000000,NULL,'31分20秒培训',5200,0),
 ('kb_seed_t2',1001,'增长方法论-播客.m4a','/培训素材','audio/mp4','audio',47000000,NULL,'48分55秒播客',6800,0),
 ('kb_seed_t3',1001,'培训讲义.md','/培训素材','text/markdown','document',9100,NULL,'培训讲义',3100,0);

-- 演示：把质检报告关联到客户 A3001（Entity Hub 实体上下文包据此聚合关联知识；幂等）
INSERT INTO kb_links (tenant_id, file_id, object_type, object_id)
SELECT 1001, 'kb_seed_q1', 'account', 'A3001'
WHERE NOT EXISTS (
  SELECT 1 FROM kb_links WHERE tenant_id=1001 AND file_id='kb_seed_q1'
    AND object_type='account' AND object_id='A3001');
