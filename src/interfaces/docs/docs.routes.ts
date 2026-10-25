import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './openapi.js';

export const docsRoutes = Router();

docsRoutes.get('/api/docs/openapi.json', (_request, response) => {
  response.status(200).json(openApiDocument);
});

docsRoutes.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, {
  customSiteTitle: 'QuimiPort API | Swagger UI',
}));
