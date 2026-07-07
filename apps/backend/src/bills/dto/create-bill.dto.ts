import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class BillLineDto {
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

export class CreateBillDto {
  @IsString()
  @MinLength(1)
  number!: string;

  @IsString()
  contactId!: string;

  @IsDateString()
  issueDate!: string;

  @IsDateString()
  dueDate!: string;

  @IsNumber()
  @Min(0)
  vatAmount!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  whtAmount?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BillLineDto)
  lines!: BillLineDto[];
}
