import { Test, TestingModule } from '@nestjs/testing';
import { UpdatePasswordService } from './update-password.service';

describe('UpdatePasswordService', () => {
  let service: UpdatePasswordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UpdatePasswordService],
    }).compile();

    service = module.get<UpdatePasswordService>(UpdatePasswordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
