import { Test, TestingModule } from '@nestjs/testing';
import { UpdatePasswordController } from './update-password.controller';
import { UpdatePasswordService } from './update-password.service';

describe('UpdatePasswordController', () => {
  let controller: UpdatePasswordController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UpdatePasswordController],
      providers: [UpdatePasswordService],
    }).compile();

    controller = module.get<UpdatePasswordController>(UpdatePasswordController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
