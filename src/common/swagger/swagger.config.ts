import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export class SwaggerConfig {
  static setup(app: INestApplication): void {
    const config = new DocumentBuilder()
      .setTitle('Blockchain Intent Solver API')
      .setDescription(
        'API for blockchain intent solving system that supports multiple chains (EVM and Solana) with a modular architecture. ' +
          'This service validates and fulfills cross-chain intents using various strategies.',
      )
      .setVersion('1.0')
      .addApiKey(
        {
          type: 'apiKey',
          name: 'X-API-Key',
          in: 'header',
          description:
            'API key for authentication. Can also be passed as "api_key" query parameter.',
        },
        'api-key',
      )
      .addTag('quotes', 'Intent validation and fee calculation endpoints')
      .addTag('health', 'Health check endpoints for monitoring')
      .setContact('Eco Protocol', 'https://eco.com', 'support@eco.com')
      .setLicense('MIT', 'https://opensource.org/licenses/MIT')
      .addServer('http://localhost:3000', 'Local Development')
      .addServer('https://api.solver.eco.com', 'Production')
      .build();

    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup('api-docs', app, document, {
      customSiteTitle: 'Blockchain Intent Solver API',
      customfavIcon: 'https://eco.com/favicon.ico',
      customCss: '.swagger-ui .topbar { display: none }',
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
        filter: true,
        showRequestDuration: true,
      },
    });
  }
}
