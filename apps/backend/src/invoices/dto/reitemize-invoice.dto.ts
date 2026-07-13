import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsString, Min, MinLength, ValidateNested } from 'class-validator';

export class ReitemizeLineDto {
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

export class ReitemizeInvoiceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReitemizeLineDto)
  lines!: ReitemizeLineDto[];
}
