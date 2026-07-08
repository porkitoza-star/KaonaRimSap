import { IsDateString, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class ConfirmDocumentDto {
  @IsString()
  @MinLength(1)
  documentNumber!: string;

  @IsDateString()
  issueDate!: string;

  @IsDateString()
  dueDate!: string;

  @IsString()
  @MinLength(1)
  contactName!: string;

  @IsOptional()
  @IsString()
  contactTaxId?: string;

  @IsNumber()
  @Min(0.01)
  subtotal!: number;

  @IsNumber()
  @Min(0)
  vatAmount!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  whtAmount?: number;

  @IsString()
  costCenterId!: string;

  @IsString()
  accountId!: string;

  @IsOptional()
  @IsString()
  workCategory?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
