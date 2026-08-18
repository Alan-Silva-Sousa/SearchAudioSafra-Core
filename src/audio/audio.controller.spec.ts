import { Test, TestingModule } from '@nestjs/testing';
import { AudioController } from './audio.controller';
import { CanonicalAudioService } from './canonical-audio.service';
import { AccessGroupService } from '../access/access-group.service';
import { ActionPermissionService } from '../access/action-permission.service';
import { JwtAuthGuard } from '../user/jwt-auth.guard';

describe('AudioController', () => {
  let controller: AudioController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AudioController],
      providers: [
        { provide: CanonicalAudioService, useValue: {} },
        { provide: AccessGroupService, useValue: {} },
        { provide: ActionPermissionService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AudioController>(AudioController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
