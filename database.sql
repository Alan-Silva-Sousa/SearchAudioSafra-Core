-- 9.1 gravacoes
CREATE TABLE gravacoes (
    id UUID PRIMARY KEY,
    sistema_origem VARCHAR,
    id_origem VARCHAR,
    data_gravacao DATE,
    hora_inicio TIME,
    hora_fim TIME,
    duracao_segundos INT,
    agente VARCHAR,
    origem VARCHAR,
    destino VARCHAR,
    hash_integridade VARCHAR,
    referencia_audio TEXT
);

-- 9.2 usuarios
CREATE TABLE usuarios (
    id UUID PRIMARY KEY,
    login VARCHAR,
    nome VARCHAR,
    perfil VARCHAR,
    ativo BOOLEAN,
    ultimo_login TIMESTAMP
);

-- 9.3 permissoes
CREATE TABLE permissoes (
    id UUID PRIMARY KEY,
    perfil VARCHAR,
    recurso VARCHAR,
    acao VARCHAR
);

-- 9.4 log_auditoria
CREATE TABLE log_auditoria (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP,
    usuario VARCHAR,
    perfil VARCHAR,
    acao VARCHAR,
    id_gravacao UUID,
    ip_origem VARCHAR,
    resultado VARCHAR
);
