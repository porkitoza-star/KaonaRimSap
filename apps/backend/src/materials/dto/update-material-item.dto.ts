import { PartialType } from '@nestjs/mapped-types';
import { CreateMaterialItemDto } from './create-material-item.dto';

export class UpdateMaterialItemDto extends PartialType(CreateMaterialItemDto) {}
