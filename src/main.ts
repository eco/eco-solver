import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '@/app.module';
import { AppConfigService } from '@/modules/config/services';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const appConfig = app.get(AppConfigService);
  const port = appConfig.port || 3000;

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap();