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

export class PayAllocationDto {
  @IsString()
  billId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;
}

export class ProposePaymentDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  method?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PayAllocationDto)
  allocations!: PayAllocationDto[];
}
