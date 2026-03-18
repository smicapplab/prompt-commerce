import { Controller, Post, Request, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import type { AuthenticatedUser } from './auth.service';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/login
   * Body: { username, password }
   * Returns: { access_token }
   *
   * The LocalAuthGuard runs passport-local which calls LocalStrategy.validate().
   * If credentials are valid, req.user is populated with the AuthenticatedUser.
   */
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Request() req: RequestWithUser): { access_token: string } {
    return this.authService.login(req.user);
  }
}
