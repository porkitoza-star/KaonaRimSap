import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ContactType } from '@prisma/client';

export class CreateContactDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(ContactType)
  type!: ContactType;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
