require('dotenv').config();
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
});

const bucket = process.env.AWS_S3_BUCKET;

//listar arquivos de dentro do s3, se existir
async function listarArquivos() {
  try {
    const command = new ListObjectsV2Command({ Bucket: bucket });
    const response = await s3Client.send(command);

    if (!response.Contents || response.Contents.length === 0) {
      console.log(`Bucket "${bucket}" está vazio ou não retornou arquivos.`);
      return;
    }

    console.log(`Arquivos encontrados no bucket "${bucket}":\n`);
    response.Contents.forEach(item => {
      console.log(`- ${item.Key} (${item.Size} bytes, modificado em ${item.LastModified})`);
    });
  } catch (err) {
    console.error('Erro ao listar arquivos do S3:', err.message);
  }
}

// baixando arquivo de teste que ja existe no s3
// async function getArquivoTeste(key) {
//   try {
//     const command = new GetObjectCommand({ Bucket: bucket, Key: key });
//     const response = await s3Client.send(command);
 
//     // endereco do lugar que quero que salve
//     const pastaDestino = 'C:\\Users\\andre.borges\\Desktop\\Projetos\\SearchAudio4me\\Gravacoes-teste\\recordings\\teste-s3-aws';
//     fs.mkdirSync(pastaDestino, { recursive: true });
 
//     const nomeArquivo = path.basename(key);
//     const destinoPath = path.join(pastaDestino, nomeArquivo);
 
//     await pipeline(response.Body, fs.createWriteStream(destinoPath));
 
//     console.log(`Arquivo "${key}" baixado com sucesso para "${destinoPath}".`);
//     return destinoPath;
//   } catch (err) {
//     console.error('Erro ao baixar arquivo do S3:', err.message);
//   }
// }

// Exemplo de uso (troque 'nome-do-arquivo.mp3' pela key real que
// apareceu na listagem do bucket):
//
// getArquivoTeste('nome-do-arquivo.mp3');

listarArquivos();
// getArquivoTeste('desenvolvimento/2026/07/24/video-005.mp4');//por o endereço do arquivo que quer baixar