import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class InvoiceLineDto {
  @IsString()
  @MinLength(1)
  description!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  costCenterId!: string;

  @IsString()
  accountId!: string;
}

export class CreateInvoiceDto {
  @IsString()
  @MinLength(1)
  number!: string;

  @IsString()
  contactId!: string;

  @IsDateString()
  issueDate!: string;

  @IsDateString()
  dueDate!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[];
}
