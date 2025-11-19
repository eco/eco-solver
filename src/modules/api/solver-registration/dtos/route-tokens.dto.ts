import { ApiProperty } from '@nestjs/swagger';

import { ArrayMinSize, IsNotEmpty } from 'class-validator';

export class RouteTokensDTO {
  @ApiProperty()
  @IsNotEmpty()
  send: string;

  @ApiProperty({ type: [String] })
  @IsNotEmpty()
  @ArrayMinSize(1)
  receive: string[];
}
