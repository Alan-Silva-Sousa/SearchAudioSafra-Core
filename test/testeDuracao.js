const { parseFile } = require('music-metadata');

const filePath = 'C:\\Users\\andre.borges\\Desktop\\Projetos\\SearchAudio4me\\Gravacoes-teste\\recordings\\audio-teste.m4a';
const filePath2 = 'C:\\Users\\andre.borges\\Desktop\\Projetos\\SearchAudio4me\\Gravacoes-teste\\recordings\\audio-teste2.m4a';

// parseFile(filePath).then(metadata => {
//   console.log('Duração exata (segundos):', metadata.format.duration);
//   console.log('Duração arredondada:', Math.round(metadata.format.duration));
//   console.log('Container:', metadata.format.container);
//   console.log('Codec:', metadata.format.codec);
//   console.log('Sample rate:', metadata.format.sampleRate);
//   console.log('Metadata completa format:', JSON.stringify(metadata.format, null, 2));
// }).catch(err => console.error('Erro:', err.message));

parseFile(filePath2).then(metadata => {
  console.log('Duração exata (segundos):', metadata.format.duration);
  console.log('Duração arredondada:', Math.round(metadata.format.duration));
  console.log('Container:', metadata.format.container);
  console.log('Codec:', metadata.format.codec);
  console.log('Sample rate:', metadata.format.sampleRate);
  console.log('Metadata completa format:', JSON.stringify(metadata.format, null, 2));
}).catch(err => console.error('Erro:', err.message));
