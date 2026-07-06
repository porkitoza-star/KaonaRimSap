import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { WhtCertType } from '@prisma/client';

export class CreateWhtCertificateDto {
  @IsString()
  billId!: string;

  @IsOptional()
  @IsString()
  paymentId?: string;

  @IsEnum(WhtCertType)
  certType!: WhtCertType;

  @IsString()
  @MinLength(1)
  incomeTypeCode!: string;

  @IsNumber()
  @Min(0.01)
  baseAmount!: number;

  @IsNumber()
  @Min(0)
  whtRate!: number;

  @IsDateString()
  issueDate!: string;
}
