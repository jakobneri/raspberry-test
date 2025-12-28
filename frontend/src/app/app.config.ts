import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
  HttpRequest,
  HttpHandlerFn,
} from '@angular/common/http';

import { routes } from './app.routes';

// Interceptor to ensure credentials are sent with all requests
const credentialsInterceptor = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const clonedReq = req.clone({
    withCredentials: true,
  });
  return next(clonedReq);
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([credentialsInterceptor])),
  ],
};
