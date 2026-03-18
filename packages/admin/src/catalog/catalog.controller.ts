import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CatalogService,
  type CreateProductDto,
  type UpdateProductDto,
  type CreateCategoryDto,
  type ProductRecord,
  type CategoryRecord,
} from './catalog.service';

@UseGuards(JwtAuthGuard)
@Controller('api/catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // ── Products ────────────────────────────────────────────────────────────────

  /** GET /api/catalog/products?search=&category_id= */
  @Get('products')
  listProducts(
    @Query('search') search?: string,
    @Query('category_id') categoryId?: string,
  ): ProductRecord[] {
    return this.catalogService.listProducts(
      search,
      categoryId ? parseInt(categoryId, 10) : undefined,
    );
  }

  /** GET /api/catalog/products/:id */
  @Get('products/:id')
  getProduct(@Param('id', ParseIntPipe) id: number): ProductRecord {
    return this.catalogService.getProduct(id);
  }

  /** POST /api/catalog/products */
  @Post('products')
  createProduct(@Body() dto: CreateProductDto): ProductRecord {
    return this.catalogService.createProduct(dto);
  }

  /** PATCH /api/catalog/products/:id */
  @Patch('products/:id')
  updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
  ): ProductRecord {
    return this.catalogService.updateProduct(id, dto);
  }

  /** DELETE /api/catalog/products/:id */
  @Delete('products/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteProduct(@Param('id', ParseIntPipe) id: number): void {
    this.catalogService.deleteProduct(id);
  }

  // ── Categories ──────────────────────────────────────────────────────────────

  /** GET /api/catalog/categories */
  @Get('categories')
  listCategories(): CategoryRecord[] {
    return this.catalogService.listCategories();
  }

  /** POST /api/catalog/categories */
  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto): CategoryRecord {
    return this.catalogService.createCategory(dto);
  }

  /** DELETE /api/catalog/categories/:id */
  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCategory(@Param('id', ParseIntPipe) id: number): void {
    this.catalogService.deleteCategory(id);
  }
}
