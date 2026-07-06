import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ManualJournalLineDto {
  @IsString()
  accountId!: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  debit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  credit?: number;

  @IsOptional()
  @IsString()
  memo?: string;
}

export class CreateManualJournalEntryDto {
  @IsDateString()
  entryDate!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualJournalLineDto)
  lines!: ManualJournalLineDto[];
}
