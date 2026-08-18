import { buildCanonicalRecordingClauses, normalizeAuditEndDate, normalizeAuditStartDate } from './canonical-recording-filters';

describe('canonical-recording-filters', () => {
  it('monta filtro de periodo e participant data', () => {
    const result = buildCanonicalRecordingClauses(
      ['RecordStartStart', 'RecordStartEnd', 'ParticipantData'],
      ['2026-08-14', '2026-08-17', '12345678900'],
      ['', '', 'CPF'],
    );

    expect(result.clauses).toHaveLength(3);
    expect(result.clauses[0]).toContain('conversation_start_time::date >=');
    expect(result.clauses[1]).toContain('conversation_start_time::date <=');
    expect(result.clauses[2]).toContain('p.cpf');
    expect(result.clauses[2]).toContain('participant_attributes');
  });

  it('normaliza datas de auditoria para o dia inteiro', () => {
    expect(normalizeAuditStartDate('2026-08-14')).toBe('2026-08-14T00:00:00.000Z');
    expect(normalizeAuditEndDate('2026-08-17')).toBe('2026-08-17T23:59:59.999Z');
  });
});
