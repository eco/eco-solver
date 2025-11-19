import { ApiProperty } from '@nestjs/swagger';

import { IsNotEmpty } from 'class-validator';

export class RouteTokensDTO {
  @ApiProperty()
  @IsNotEmpty()
  send: string;

  @ApiProperty({ type: [String] })
  @IsNotEmpty()
  receive: string[];
}
