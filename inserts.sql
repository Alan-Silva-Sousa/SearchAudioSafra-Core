-- =========================================================
-- 30 gravacoes ficticias (IDs sequenciais legiveis)
-- =========================================================

INSERT INTO gravacoes (
    id, sistema_origem, id_origem, data_gravacao, hora_inicio, hora_fim,
    duracao_segundos, agente, origem, destino, hash_integridade, referencia_audio
) VALUES
('00000000-0000-0000-0000-000000000001', 'NTR', 'CALL-001', '2026-07-17', '13:41:00', '13:42:23', 69, 'joao.silva', '11981924865', '1132579240', 'hash-mock-001', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000002', 'Engage', 'CALL-002', '2026-07-23', '10:02:00', '10:03:15', 89, 'fernanda.costa', '11966126116', '1132171979', 'hash-mock-002', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000003', 'Engage', 'CALL-003', '2026-07-23', '13:03:00', '13:08:36', 334, 'joao.silva', '11939962626', '1132037872', 'hash-mock-003', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000004', 'NTR', 'CALL-004', '2026-07-15', '10:02:00', '10:07:26', 330, 'bruno.almeida', '11927874421', '1135858837', 'hash-mock-004', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000005', 'Engage', 'CALL-005', '2026-07-23', '08:36:00', '08:39:37', 202, 'lucas.pereira', '11934256684', '1132728987', 'hash-mock-005', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000006', 'Engage', 'CALL-006', '2026-07-20', '08:35:00', '08:36:31', 77, 'lucas.pereira', '11917999533', '1134455413', 'hash-mock-006', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000007', 'NTR', 'CALL-007', '2026-07-20', '14:37:00', '14:41:50', 277, 'carlos.oliveira', '11950234045', '1135167906', 'hash-mock-007', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000008', 'Engage', 'CALL-008', '2026-07-18', '08:36:00', '08:39:46', 198, 'lucas.pereira', '11976453392', '1136762565', 'hash-mock-008', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000009', 'NTR', 'CALL-009', '2026-07-19', '16:04:00', '16:05:48', 105, 'lucas.pereira', '11966119495', '1133767604', 'hash-mock-009', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000010', 'NTR', 'CALL-010', '2026-07-17', '14:26:00', '14:27:21', 65, 'ana.martins', '11920418044', '1136263809', 'hash-mock-010', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000011', 'NTR', 'CALL-011', '2026-07-24', '14:37:00', '14:41:30', 278, 'joao.silva', '11922562241', '1135528829', 'hash-mock-011', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000012', 'Engage', 'CALL-012', '2026-07-15', '18:44:00', '18:47:18', 203, 'ana.martins', '11987570629', '1138476611', 'hash-mock-012', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000013', 'NTR', 'CALL-013', '2026-07-20', '07:29:00', '07:32:31', 226, 'maria.souza', '11991996233', '1132964541', 'hash-mock-013', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000014', 'Engage', 'CALL-014', '2026-07-18', '19:18:00', '19:19:25', 111, 'ana.martins', '11943234300', '1137675615', 'hash-mock-014', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000015', 'NTR', 'CALL-015', '2026-07-16', '09:28:00', '09:32:52', 250, 'lucas.pereira', '11947290936', '1133297239', 'hash-mock-015', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000016', 'NTR', 'CALL-016', '2026-07-23', '11:45:00', '11:49:09', 257, 'carlos.oliveira', '11961061966', '1134871367', 'hash-mock-016', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000017', 'Engage', 'CALL-017', '2026-07-17', '09:14:00', '09:20:53', 382, 'maria.souza', '11911619076', '1139136324', 'hash-mock-017', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000018', 'Engage', 'CALL-018', '2026-07-19', '11:00:00', '11:01:39', 119, 'fernanda.costa', '11981751584', '1137195046', 'hash-mock-018', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000019', 'NTR', 'CALL-019', '2026-07-17', '18:54:00', '18:59:29', 308, 'lucas.pereira', '11997908110', '1131905850', 'hash-mock-019', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000020', 'NTR', 'CALL-020', '2026-07-21', '13:25:00', '13:26:03', 98, 'fernanda.costa', '11995132904', '1137718312', 'hash-mock-020', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000021', 'Engage', 'CALL-021', '2026-07-16', '10:28:00', '10:30:06', 128, 'joao.silva', '11955641228', '1131882072', 'hash-mock-021', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000022', 'Engage', 'CALL-022', '2026-07-24', '09:34:00', '09:35:04', 96, 'carlos.oliveira', '11992374421', '1131427833', 'hash-mock-022', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000023', 'Engage', 'CALL-023', '2026-07-24', '13:09:00', '13:15:30', 369, 'carlos.oliveira', '11956625835', '1137109648', 'hash-mock-023', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000024', 'Engage', 'CALL-024', '2026-07-16', '14:29:00', '14:33:09', 290, 'fernanda.costa', '11951856109', '1132440905', 'hash-mock-024', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000025', 'Engage', 'CALL-025', '2026-07-20', '18:16:00', '18:20:01', 290, 'bruno.almeida', '11931667923', '1139662655', 'hash-mock-025', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000026', 'Engage', 'CALL-026', '2026-07-23', '12:09:00', '12:15:19', 398, 'lucas.pereira', '11913629581', '1139860206', 'hash-mock-026', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000027', 'Engage', 'CALL-027', '2026-07-19', '15:23:00', '15:25:34', 130, 'carlos.oliveira', '11939902737', '1139935417', 'hash-mock-027', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000028', 'NTR', 'CALL-028', '2026-07-18', '16:51:00', '16:53:47', 144, 'bruno.almeida', '11942130069', '1137722368', 'hash-mock-028', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000029', 'Engage', 'CALL-029', '2026-07-18', '15:31:00', '15:34:50', 227, 'ana.martins', '11913889649', '1131468706', 'hash-mock-029', 'https://www.w3schools.com/html/horse.mp3'),
('00000000-0000-0000-0000-000000000030', 'NTR', 'CALL-030', '2026-07-22', '11:12:00', '11:18:51', 399, 'lucas.pereira', '11956208603', '1138503235', 'hash-mock-030', 'https://www.w3schools.com/html/horse.mp3');
