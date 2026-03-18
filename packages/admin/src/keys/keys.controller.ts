import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KeysService } from './keys.service';

class SetLlmKeyDto {
  key!: string;
}

@UseGuards(JwtAuthGuard)
@Controller('api/keys')
export class KeysController {
  constructor(private readonly keysService: KeysService) {}

  /**
   * GET /api/keys
   * Returns the current keys. The LLM API key is masked (shows only last 4 chars).
   */
  @Get()
  getKeys() {
    return this.keysService.getKeys();
  }

  /**
   * POST /api/keys/llm
   * Body: { key: string }
   * Save (or replace) the LLM API key.
   */
  @Post('llm')
  @HttpCode(HttpStatus.NO_CONTENT)
  setLlmKey(@Body() dto: SetLlmKeyDto): void {
    this.keysService.setLlmApiKey(dto.key);
  }

  /**
   * POST /api/keys/gateway/generate
   * Generate a new gateway key. Returns the new key (only time it's shown in full).
   */
  @Post('gateway/generate')
  generateGatewayKey(): { gateway_key: string } {
    const key = this.keysService.generateGatewayKey();
    return { gateway_key: key };
  }

  /**
   * DELETE /api/keys/gateway
   * Revoke the current gateway key (re-opens the MCP server until a new key is generated).
   */
  @Delete('gateway')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeGatewayKey(): void {
    this.keysService.revokeGatewayKey();
  }
}
