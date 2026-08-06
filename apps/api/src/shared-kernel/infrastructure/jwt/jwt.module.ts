import { Module, Global } from '@nestjs/common';
import { JwtTokenService } from './jwt-token.service';

@Global()
@Module({
  providers: [JwtTokenService],
  exports: [JwtTokenService],
})
export class JwtModule {}
