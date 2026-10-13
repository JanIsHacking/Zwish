import { Injectable } from '@nestjs/common';
import { DomainError } from '../../domain/access';
import { hashSessionToken, newSessionToken, verifyPassword } from '../../common/auth/password';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PublicUser } from '../users/public-user';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async login(name: string, password: string): Promise<{ token: string; user: PublicUser }> {
    const user = await this.prisma.user.findUnique({ where: { name: name.trim() } });
    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      throw new DomainError('INVALID_CREDENTIALS', 401, 'Name or password is wrong');
    }
    const session = newSessionToken();
    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: session.tokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    return { token: session.token, user: this.users.toPublic(user) };
  }

  async logout(token: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  }

  async userFromToken(token: string): Promise<PublicUser | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt.getTime() < Date.now()) {
      return null;
    }
    return this.users.toPublic(session.user);
  }
}
