import { IsOptional, IsString } from 'class-validator';

export class RejectPaymentDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
