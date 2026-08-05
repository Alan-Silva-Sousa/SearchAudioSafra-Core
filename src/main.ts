import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const frontUrl = process.env.FRONT_URL;
  const frontOrigin = frontUrl ? new URL(frontUrl).origin : undefined;
  app.enableCors({
    origin: frontOrigin ? [frontOrigin] : false,
    credentials: true,
  });

  // Configuração do Swagger
  const config = new DocumentBuilder()
    .setTitle('SearchAudio4me API')
    .setDescription('API para gerenciamento e busca de gravações de áudio')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Autenticação', 'Endpoints de login e registro')
    .addTag('Áudio', 'Gerenciamento de gravações de áudio')
    .addTag('Configurações', 'Campanhas, agentes, disposições e divisões')
    .addTag('Logs', 'Histórico de ações do sistema')
    .addTag('Usuários', 'Gerenciamento de usuários')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  await app.listen(process.env.PORT ?? 3000);
  console.log(`\n🚀 Aplicação rodando em: http://localhost:${process.env.PORT ?? 3000}/api`);
  console.log(`📚 Documentação Swagger: http://localhost:${process.env.PORT ?? 3000}/api/docs\n`);
}
bootstrap();
