import { ExpressAdapter } from '@bull-board/express';

import { BullBoardConfigService } from '@/modules/config/services/bull-board-config.service';

/**
 * Factory to create an Express adapter with authentication based on configuration
 */
export function createBullBoardAdapter(bullBoardConfig: BullBoardConfigService): typeof ExpressAdapter {
  
  class ConfiguredExpressAdapter extends ExpressAdapter {
    constructor() {
      super();
      
      // If auth is required, add middleware to the router
      if (bullBoardConfig.requiresAuth) {
        this.addAuthMiddleware();
      }
    }

    private addAuthMiddleware() {
      const router = this.getRouter();
      if (router) {
        const username = bullBoardConfig.username;
        const password = bullBoardConfig.password;
        
        // Add basic auth middleware before any other routes
        router.use((req: any, res: any, next: any) => {
          const authHeader = req.headers.authorization;
          
          if (!authHeader || !authHeader.startsWith('Basic ')) {
            res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board Admin"');
            return res.status(401).send('Authentication required');
          }
          
          const base64Credentials = authHeader.split(' ')[1];
          const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
          const [authUsername, authPassword] = credentials.split(':');
          
          if (authUsername === username && authPassword === password) {
            return next();
          }
          
          res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board Admin"');
          return res.status(401).send('Authentication required');
        });
      }
    }
  }
  
  return ConfiguredExpressAdapter;
}