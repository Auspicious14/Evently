import { Test, TestingModule } from '@nestjs/testing';
import { AccessRequestsController } from './access-requests.controller';
import { AccessRequestsService } from './access-requests.service';
import { LinksService } from '../links/links.service';

describe('AccessRequestsController', () => {
  let controller: AccessRequestsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccessRequestsController],
      providers: [
        {
          provide: AccessRequestsService,
          useValue: {},
        },
        {
          provide: LinksService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<AccessRequestsController>(
      AccessRequestsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});