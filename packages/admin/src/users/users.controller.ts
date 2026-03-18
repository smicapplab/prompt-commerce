import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService, type UserRecord } from './users.service';

class CreateUserDto {
  username!: string;
  password!: string;
  role?: string;
}

class ChangePasswordDto {
  password!: string;
}

@UseGuards(JwtAuthGuard)
@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** GET /api/users — list all users */
  @Get()
  findAll(): UserRecord[] {
    return this.usersService.findAll();
  }

  /** POST /api/users — create a new admin user */
  @Post()
  create(@Body() dto: CreateUserDto): Promise<UserRecord> {
    return this.usersService.create(dto.username, dto.password, dto.role);
  }

  /** PATCH /api/users/:id/password — change a user's password */
  @Patch(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.usersService.changePassword(id, dto.password);
  }

  /** DELETE /api/users/:id — remove a user */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id', ParseIntPipe) id: number): void {
    this.usersService.delete(id);
  }
}
