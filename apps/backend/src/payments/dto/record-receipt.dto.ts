import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReceiveAllocationDto {
  @IsString()
  invoiceId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;
}

export class RecordReceiptDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  method?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveAllocationDto)
  allocations!: ReceiveAllocationDto[];
}
