import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    methods: '*',
    allowedHeaders: '*',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('ReviewIQ')
    .setDescription('AI Powered business review analytics')
    .setVersion('1.0.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/', (req: any, res: any) => {
    res.json({ status: 'ReviewIQ backend is running' });
  });

  const port = process.env.PORT || 8000;
  await app.listen(port);
  console.log(`ReviewIQ NestJS AI backend is running on port ${port}`);
  console.log(`Swagger documentation available at http://localhost:${port}/docs`);
}
bootstrap();
