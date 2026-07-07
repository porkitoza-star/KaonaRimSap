import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { StockTransactionType } from '@prisma/client';

export class CreateStockTransactionDto {
  @IsEnum(StockTransactionType)
  type!: StockTransactionType;

  @IsNumber()
  quantity!: number;

  @IsDateString()
  transactionDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
