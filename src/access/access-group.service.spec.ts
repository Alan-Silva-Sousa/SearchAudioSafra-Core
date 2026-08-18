import { mediaScopedSlug } from './access-group.service';

describe('mediaScopedSlug', () => {
  it('adiciona o prefixo de audio ao slug legado', () => {
    expect(mediaScopedSlug('grupo-a', 'audio')).toBe('audio-grupo-a');
  });

  it('preserva os slugs que ja possuem prefixo', () => {
    expect(mediaScopedSlug('audio-grupo-a', 'audio')).toBe('audio-grupo-a');
    expect(mediaScopedSlug('video-grupo-a', 'audio')).toBe('video-grupo-a');
  });
});
