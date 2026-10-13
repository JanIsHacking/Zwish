export interface AppEnv {
  nodeEnv: string;
  port: number;
  adminUsername: string;
  adminPassword: string | null;
  cookieSecure: boolean;
  webOrigin: string;
}

export function loadEnv(): AppEnv {
  const adminPassword = process.env.ADMIN_PASSWORD?.trim() ?? '';
  return {
    nodeEnv: process.env.NODE_ENV ?? 'local',
    port: Number(process.env.PORT ?? 8000),
    adminUsername: process.env.ADMIN_USERNAME?.trim() || 'admin',
    adminPassword: adminPassword.length > 0 ? adminPassword : null,
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  };
}

export const ENV = Symbol('ENV');
