import { Module, Global } from '@nestjs/common';
import { GenesysService } from './genesys.service';

@Global()
@Module({
  providers: [GenesysService],
  exports: [GenesysService],
})
export class GenesysModule {}
