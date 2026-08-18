type FilterClauseBuilder = {
  clauses: string[];
  values: unknown[];
  parameterIndex: number;
};

function nextParameter(builder: FilterClauseBuilder): string {
  const parameter = `$${builder.parameterIndex}`;
  builder.parameterIndex += 1;
  return parameter;
}

function appendParticipantDataFilter(
  builder: FilterClauseBuilder,
  field: string,
  value: string,
): void {
  const needle = `%${value}%`;
  const fieldParameter = nextParameter(builder);
  builder.values.push(field);
  const valueParameter = nextParameter(builder);
  builder.values.push(needle);

  const columnByField: Record<string, string> = {
    CPF: 'cpf',
    CNPJ: 'cnpj',
    AGENCIA: 'agencia',
    CONTA: 'conta',
    CONTRATO: 'contrato',
    PROTOCOLO: 'protocolo',
  };

  if (field === 'Nome do Agente') {
    builder.clauses.push(`(
      COALESCE(p.participant_attributes ->> ${fieldParameter}, '') ILIKE ${valueParameter}
      OR COALESCE(p.participant_attributes ->> 'agente_nome', '') ILIKE ${valueParameter}
      OR COALESCE(p.participant_attributes ->> 'Nome Agente', '') ILIKE ${valueParameter}
      OR EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.user_ids, ARRAY[]::varchar[])) AS uid
        WHERE uid ILIKE ${valueParameter}
      )
    )`);
    return;
  }

  if (field === 'Login do Agente') {
    builder.clauses.push(`(
      COALESCE(p.participant_attributes ->> ${fieldParameter}, '') ILIKE ${valueParameter}
      OR COALESCE(p.participant_attributes ->> 'agente_login', '') ILIKE ${valueParameter}
      OR COALESCE(p.participant_attributes ->> 'Login Agente', '') ILIKE ${valueParameter}
      OR EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.user_ids, ARRAY[]::varchar[])) AS uid
        WHERE uid ILIKE ${valueParameter}
      )
    )`);
    return;
  }

  const column = columnByField[field.toUpperCase()];
  if (column) {
    builder.clauses.push(`(
      COALESCE(NULLIF(BTRIM(p.${column}), ''), '') ILIKE ${valueParameter}
      OR COALESCE(p.participant_attributes ->> ${fieldParameter}, '') ILIKE ${valueParameter}
    )`);
    return;
  }

  builder.clauses.push(
    `COALESCE(p.participant_attributes ->> ${fieldParameter}, '') ILIKE ${valueParameter}`,
  );
}

export function appendCanonicalRecordingFilter(
  builder: FilterClauseBuilder,
  type: string,
  value: string,
  filterField?: string,
): void {
  if (!type || !value) return;
  const parameter = nextParameter(builder);
  builder.values.push(value);

  if (type === 'RecordStart') {
    builder.clauses.push(`p.conversation_start_time::date = ${parameter}::date`);
    return;
  }
  if (type === 'RecordStartStart') {
    builder.clauses.push(`p.conversation_start_time::date >= ${parameter}::date`);
    return;
  }
  if (type === 'RecordStartEnd') {
    builder.clauses.push(`p.conversation_start_time::date <= ${parameter}::date`);
    return;
  }
  if (type === 'RecordStartHourStart') {
    builder.clauses.push(`(p.conversation_start_time AT TIME ZONE 'America/Sao_Paulo')::time >= ${parameter}::time`);
    return;
  }
  if (type === 'RecordStartHourEnd') {
    builder.clauses.push(`(p.conversation_start_time AT TIME ZONE 'America/Sao_Paulo')::time <= ${parameter}::time`);
    return;
  }
  if (type === 'CustomerPhone') {
    const digits = String(value).replace(/\D/g, '');
    if (!digits) {
      builder.values.pop();
      builder.parameterIndex -= 1;
      return;
    }
    builder.values[builder.values.length - 1] = `%${digits}%`;
    builder.clauses.push(
      `regexp_replace(COALESCE(NULLIF(BTRIM(p.participant_attributes->>'Telefone Cliente'), ''), NULLIF(BTRIM(p.participant_attributes->>'telefone'), ''), decrypt_value(p.ani_normalized, $3), ''), '[^0-9]', '', 'g') LIKE ${parameter}`,
    );
    return;
  }
  if (type === 'DestinationPhone') {
    const digits = String(value).replace(/\D/g, '');
    if (!digits) {
      builder.values.pop();
      builder.parameterIndex -= 1;
      return;
    }
    builder.values[builder.values.length - 1] = `%${digits}%`;
    builder.clauses.push(
      `regexp_replace(COALESCE(NULLIF(BTRIM(p.participant_attributes->>'Telefone Destino'), ''), decrypt_value(p.dnis_normalized, $3), ''), '[^0-9]', '', 'g') LIKE ${parameter}`,
    );
    return;
  }
  if (type === 'Document') {
    const digits = String(value).replace(/\D/g, '');
    if (!digits) {
      builder.values.pop();
      builder.parameterIndex -= 1;
      return;
    }
    builder.values[builder.values.length - 1] = `%${digits}%`;
    builder.clauses.push(`(
      regexp_replace(COALESCE(p.cpf, ''), '[^0-9]', '', 'g') LIKE ${parameter}
      OR regexp_replace(COALESCE(p.cnpj, ''), '[^0-9]', '', 'g') LIKE ${parameter}
      OR regexp_replace(COALESCE(p.participant_attributes->>'Doc Cliente', ''), '[^0-9]', '', 'g') LIKE ${parameter}
      OR regexp_replace(COALESCE(p.participant_attributes->>'doc_cliente', ''), '[^0-9]', '', 'g') LIKE ${parameter}
      OR regexp_replace(COALESCE(p.participant_attributes->>'CPF', ''), '[^0-9]', '', 'g') LIKE ${parameter}
      OR regexp_replace(COALESCE(p.participant_attributes->>'cnpj', ''), '[^0-9]', '', 'g') LIKE ${parameter}
      OR regexp_replace(COALESCE(p.participant_attributes->>'CNPJ', ''), '[^0-9]', '', 'g') LIKE ${parameter}
    )`);
    return;
  }
  if (type === 'QueueSkill') {
    builder.values[builder.values.length - 1] = `%${value}%`;
    builder.clauses.push(
      `COALESCE(NULLIF(BTRIM(p.participant_attributes->>'skill'), ''), NULLIF(BTRIM(p.participant_attributes->>'transfer_filas'), '')) ILIKE ${parameter}`,
    );
    return;
  }
  if (type === 'Environment') {
    builder.values[builder.values.length - 1] = `%${value}%`;
    builder.clauses.push(`COALESCE(p.participant_attributes->>'Ambiente', '') ILIKE ${parameter}`);
    return;
  }
  if (type === 'Duration') {
    builder.clauses.push(
      `CASE WHEN ${parameter} ~ '^\\d+$' THEN FLOOR(COALESCE(p.duration_ms, 0)::numeric / 1000) = ${parameter}::numeric ELSE false END`,
    );
    return;
  }
  if (type === 'Format') {
    builder.values[builder.values.length - 1] = `%${value}%`;
    const needle = String(value).toLowerCase();
    if (needle.includes('mp3') || needle.includes('mpeg')) {
      builder.clauses.push(
        `(COALESCE(p.content_type, '') ILIKE ${parameter} OR p.s3_object_key ILIKE ${parameter} OR COALESCE(p.content_type, '') ILIKE '%ogg%' OR p.s3_object_key ILIKE '%.ogg')`,
      );
    } else {
      builder.clauses.push(
        `(COALESCE(p.content_type, '') ILIKE ${parameter} OR p.s3_object_key ILIKE ${parameter})`,
      );
    }
    return;
  }
  if (type === 'FileSize') {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes < 0) return;
    builder.values.pop();
    builder.parameterIndex -= 1;
    const minParameter = nextParameter(builder);
    const maxParameter = nextParameter(builder);
    const tolerance = Math.max(1, bytes * 0.001);
    builder.values.push(bytes - tolerance, bytes + tolerance);
    builder.clauses.push(
      `COALESCE(p.file_size, 0)::numeric BETWEEN ${minParameter}::numeric AND ${maxParameter}::numeric`,
    );
    return;
  }
  if (type === 'ParticipantData') {
    const field = filterField?.trim();
    if (!field) return;
    builder.values.pop();
    builder.parameterIndex -= 1;
    appendParticipantDataFilter(builder, field, value);
  }
}

export function buildCanonicalRecordingClauses(
  filterTypes: string[],
  filterValues: string[],
  filterFields: string[] = [],
): { clauses: string[]; values: unknown[] } {
  const builder: FilterClauseBuilder = {
    clauses: [],
    values: [],
    parameterIndex: 4,
  };
  filterTypes.forEach((type, index) => {
    appendCanonicalRecordingFilter(builder, type, filterValues[index], filterFields[index]);
  });
  return { clauses: builder.clauses, values: builder.values };
}

export function normalizeAuditEndDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T23:59:59.999Z`;
  }
  return value;
}

export function normalizeAuditStartDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T00:00:00.000Z`;
  }
  return value;
}
