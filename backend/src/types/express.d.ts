import { PublicUser } from '../modules/users/public-user';

declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}

export {};
